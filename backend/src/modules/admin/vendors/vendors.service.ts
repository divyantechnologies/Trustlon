import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  KycStatus,
  Prisma,
  ProductStatus,
  SubOrderStatus,
  VendorNoteKind,
  VendorStatus,
} from '@prisma/client';
import { skip } from '../../../middlewares/admin/admin-query';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { EXPORT_LIMIT, toCsv } from '../../../middlewares/admin/csv';
import { toPage } from '../../../utils/http/pagination';
import { FileStorage } from '../../../utils/storage/file-storage';
import { PrismaService } from '../../../database/prisma.service';
import {
  ApproveKycDto,
  CommissionDto,
  KycQueueQuery,
  NoteDto,
  RejectKycDto,
  RequestDocumentsDto,
  ToggleDto,
  VendorListQuery,
} from './dto';

export const VENDOR_EVENTS = {
  KYC_DECIDED: 'vendor.kyc-decided',
  STATUS_CHANGED: 'vendor.status-changed',
} as const;

const normaliseName = (name: string | null | undefined) =>
  (name ?? '')
    .toUpperCase()
    .replace(/\b(M\/S|MS|MR|MRS|SHRI|PVT|PRIVATE|LTD|LIMITED|LLP)\b/g, '')
    .replace(/[^A-Z]/g, '');

/** Vendor management and KYC (5.2). Every change is written to the audit log with a reason. */
@Injectable()
export class AdminVendorsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: FileStorage,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: VendorListQuery) {
    const where: Prisma.VendorWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.kyc ? { kyc: { status: query.kyc } } : {}),
      ...(query.underReview !== undefined ? { underReview: query.underReview } : {}),
      ...(query.q
        ? {
            OR: [
              { displayName: { contains: query.q, mode: 'insensitive' } },
              { legalName: { contains: query.q, mode: 'insensitive' } },
              { gstin: { contains: query.q.toUpperCase() } },
              { slug: { contains: query.q.toLowerCase() } },
              { owner: { email: { contains: query.q.toLowerCase() } } },
            ],
          }
        : {}),
    };
    const orderBy: Prisma.VendorOrderByWithRelationInput =
      query.sort === 'name'
        ? { displayName: 'asc' }
        : query.sort === 'trust'
          ? { trustScore: 'desc' }
          : { createdAt: 'desc' };
    const csv = query.format === 'csv';
    const [rows, total] = await Promise.all([
      this.prisma.vendor.findMany({
        where,
        orderBy,
        skip: csv ? 0 : skip(query),
        take: csv ? EXPORT_LIMIT : query.pageSize,
        include: {
          kyc: { select: { status: true } },
          owner: { select: { email: true, mobile: true } },
        },
      }),
      this.prisma.vendor.count({ where }),
    ]);
    const gmv = await this.gmvFor(rows.map((row) => row.id));
    const items = rows.map((vendor) => ({
      id: vendor.id,
      slug: vendor.slug,
      name: vendor.displayName,
      legalName: vendor.legalName,
      gstin: vendor.gstin,
      plan: vendor.plan,
      status: vendor.status,
      kycStatus: vendor.kyc?.status ?? KycStatus.NOT_STARTED,
      trustScore: vendor.trustScore,
      isVerified: vendor.isVerified,
      isPlatformOwned: vendor.isPlatformOwned,
      underReview: vendor.underReview,
      payoutsOnHold: vendor.payoutsOnHold,
      gmvPaise: gmv.get(vendor.id) ?? 0,
      email: vendor.owner?.email ?? null,
      joinedAt: vendor.createdAt,
    }));
    if (query.sort === 'gmv') items.sort((a, b) => b.gmvPaise - a.gmvPaise);
    if (csv) {
      return toCsv(
        [
          'Name',
          'Legal name',
          'GSTIN',
          'Plan',
          'Status',
          'KYC',
          'Trust Score',
          'GMV (Rs)',
          'Email',
          'Joined',
        ],
        items.map((v) => [
          v.name,
          v.legalName,
          v.gstin,
          v.plan,
          v.status,
          v.kycStatus,
          v.trustScore,
          (v.gmvPaise / 100).toFixed(2),
          v.email,
          v.joinedAt.toISOString().slice(0, 10),
        ]),
      );
    }
    return toPage(items, total, query.page, query.pageSize);
  }

  async kycQueue(query: KycQueueQuery) {
    const rows = await this.prisma.vendorKyc.findMany({
      where: { status: query.status ?? KycStatus.SUBMITTED },
      orderBy: { submittedAt: 'asc' },
      take: 100,
      include: {
        vendor: {
          select: {
            id: true,
            displayName: true,
            legalName: true,
            createdAt: true,
            _count: { select: { documents: true } },
          },
        },
      },
    });
    return {
      items: rows.map((kyc) => ({
        vendorId: kyc.vendorId,
        name: kyc.vendor.displayName,
        legalName: kyc.vendor.legalName,
        status: kyc.status,
        submittedAt: kyc.submittedAt,
        documents: kyc.vendor._count.documents,
        checks: { pan: kyc.panCheck, gstin: kyc.gstinCheck, pennyDrop: kyc.pennyDropCheck },
        nameMatch: this.nameMatch(kyc.panName, kyc.pennyDropName),
      })),
    };
  }

  async detail(id: string) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id, deletedAt: null },
      include: {
        kyc: true,
        documents: { orderBy: { uploadedAt: 'desc' } },
        notes: { orderBy: { createdAt: 'desc' }, take: 50 },
        trustScores: { orderBy: { recordedOn: 'desc' }, take: 90 },
        owner: { select: { id: true, fullName: true, email: true, mobile: true } },
      },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    const [productCounts, products, subOrders, gmv, orderStats] = await Promise.all([
      this.prisma.product.groupBy({
        by: ['status'],
        where: { vendorId: id, deletedAt: null },
        _count: { _all: true },
      }),
      this.prisma.product.findMany({
        where: { vendorId: id, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          pricePaise: true,
          stock: true,
          imageUrl: true,
        },
      }),
      this.prisma.subOrder.findMany({
        where: { vendorId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          subOrderNumber: true,
          status: true,
          totalPaise: true,
          createdAt: true,
          orderId: true,
        },
      }),
      this.gmvFor([id]),
      this.prisma.subOrder.groupBy({
        by: ['status'],
        where: { vendorId: id },
        _count: { _all: true },
      }),
    ]);
    const kyc = vendor.kyc;
    return {
      id: vendor.id,
      slug: vendor.slug,
      name: vendor.displayName,
      legalName: vendor.legalName,
      gstin: vendor.gstin,
      plan: vendor.plan,
      status: vendor.status,
      isVerified: vendor.isVerified,
      isPlatformOwned: vendor.isPlatformOwned,
      trustScore: vendor.trustScore,
      commissionPercent: vendor.commissionBps === null ? null : vendor.commissionBps / 100,
      payoutsOnHold: vendor.payoutsOnHold,
      payoutHoldReason: vendor.payoutHoldReason,
      suspendedAt: vendor.suspendedAt,
      suspensionReason: vendor.suspensionReason,
      underReview: vendor.underReview,
      pickupPincode: vendor.pickupPincode,
      logoUrl: vendor.logoUrl,
      joinedAt: vendor.createdAt,
      kycApprovedAt: vendor.kycApprovedAt,
      owner: vendor.owner,
      gmvPaise: gmv.get(id) ?? 0,
      kyc: kyc
        ? {
            status: kyc.status,
            pan: kyc.pan,
            panName: kyc.panName,
            panCheck: kyc.panCheck,
            gstin: kyc.gstin,
            gstinLegalName: kyc.gstinLegalName,
            gstinCheck: kyc.gstinCheck,
            bankAccount: kyc.bankAccountLast4 ? `XXXXXX${kyc.bankAccountLast4}` : null,
            ifsc: kyc.ifsc,
            bankName: kyc.bankName,
            pennyDropName: kyc.pennyDropName,
            pennyDropCheck: kyc.pennyDropCheck,
            nameMatch: this.nameMatch(kyc.panName, kyc.pennyDropName),
            submittedAt: kyc.submittedAt,
            reviewedAt: kyc.reviewedAt,
            rejectionReasons: kyc.rejectionReasons,
            requestedDocuments: kyc.requestedDocuments,
            reviewNote: kyc.reviewNote,
          }
        : null,
      documents: vendor.documents.map((doc) => ({
        id: doc.id,
        type: doc.type,
        fileName: doc.fileName,
        contentType: doc.contentType,
        sizeBytes: doc.sizeBytes,
        uploadedAt: doc.uploadedAt,
      })),
      products: {
        counts: Object.fromEntries(productCounts.map((row) => [row.status, row._count._all])),
        recent: products,
      },
      orders: {
        counts: Object.fromEntries(orderStats.map((row) => [row.status, row._count._all])),
        recent: subOrders,
      },
      trustScoreHistory: vendor.trustScores
        .map((row) => ({ date: row.recordedOn.toISOString().slice(0, 10), score: row.score }))
        .reverse(),
      notes: vendor.notes.map((note) => ({
        id: note.id,
        kind: note.kind,
        body: note.body,
        by: note.authorName,
        at: note.createdAt,
      })),
    };
  }

  async document(vendorId: string, documentId: string) {
    const doc = await this.prisma.vendorDocument.findFirst({ where: { id: documentId, vendorId } });
    if (!doc) throw new NotFoundException('Document not found');
    return {
      content: await this.storage.read(doc.storageKey),
      contentType: doc.contentType,
      fileName: doc.fileName,
    };
  }

  async approveKyc(vendorId: string, dto: ApproveKycDto, actor: Actor) {
    const kyc = await this.kycFor(vendorId, [
      KycStatus.SUBMITTED,
      KycStatus.MORE_INFO_REQUIRED,
      KycStatus.REJECTED,
    ]);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.vendorKyc.update({
        where: { vendorId },
        data: {
          status: KycStatus.APPROVED,
          reviewedAt: now,
          reviewedById: actor.id,
          rejectionReasons: [],
          requestedDocuments: [],
          reviewNote: dto.reason ?? null,
        },
      });
      const vendor = await tx.vendor.update({
        where: { id: vendorId },
        data: {
          kycApprovedAt: now,
          ...(kyc.vendor.status === VendorStatus.PENDING ? { status: VendorStatus.ACTIVE } : {}),
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'kyc.approve',
          entity: 'vendor',
          entityId: vendorId,
          summary: vendor.displayName,
          reason: dto.reason,
          before: { kyc: kyc.status, status: kyc.vendor.status },
          after: { kyc: KycStatus.APPROVED, status: vendor.status },
        },
        tx,
      );
    });
    this.events.emit(VENDOR_EVENTS.KYC_DECIDED, { vendorId, status: KycStatus.APPROVED });
    return this.detail(vendorId);
  }

  async rejectKyc(vendorId: string, dto: RejectKycDto, actor: Actor) {
    const kyc = await this.kycFor(vendorId, [KycStatus.SUBMITTED, KycStatus.MORE_INFO_REQUIRED]);
    await this.prisma.$transaction(async (tx) => {
      await tx.vendorKyc.update({
        where: { vendorId },
        data: {
          status: KycStatus.REJECTED,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          rejectionReasons: dto.reasons,
          reviewNote: dto.note ?? null,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'kyc.reject',
          entity: 'vendor',
          entityId: vendorId,
          summary: kyc.vendor.displayName,
          reason: [...dto.reasons, dto.note].filter(Boolean).join('; '),
          before: { kyc: kyc.status },
          after: { kyc: KycStatus.REJECTED, reasons: dto.reasons },
        },
        tx,
      );
    });
    this.events.emit(VENDOR_EVENTS.KYC_DECIDED, {
      vendorId,
      status: KycStatus.REJECTED,
      reasons: dto.reasons,
    });
    return this.detail(vendorId);
  }

  async requestDocuments(vendorId: string, dto: RequestDocumentsDto, actor: Actor) {
    const kyc = await this.kycFor(vendorId, [KycStatus.SUBMITTED, KycStatus.MORE_INFO_REQUIRED]);
    await this.prisma.$transaction(async (tx) => {
      await tx.vendorKyc.update({
        where: { vendorId },
        data: {
          status: KycStatus.MORE_INFO_REQUIRED,
          reviewedAt: new Date(),
          reviewedById: actor.id,
          requestedDocuments: dto.documents,
          reviewNote: dto.note,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'kyc.request_documents',
          entity: 'vendor',
          entityId: vendorId,
          summary: kyc.vendor.displayName,
          reason: dto.note,
          before: { kyc: kyc.status },
          after: { kyc: KycStatus.MORE_INFO_REQUIRED, documents: dto.documents },
        },
        tx,
      );
    });
    this.events.emit(VENDOR_EVENTS.KYC_DECIDED, {
      vendorId,
      status: KycStatus.MORE_INFO_REQUIRED,
      documents: dto.documents,
    });
    return this.detail(vendorId);
  }

  /** Suspended vendors and their products disappear from the storefront at once (catalog filters on ACTIVE). */
  async suspend(vendorId: string, reason: string, actor: Actor) {
    const vendor = await this.vendor(vendorId);
    if (vendor.status === VendorStatus.SUSPENDED)
      throw new ConflictException('This vendor is already suspended');
    if (vendor.isPlatformOwned)
      throw new BadRequestException('Trustlon’s own brand can’t be suspended');
    await this.prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendorId },
        data: {
          status: VendorStatus.SUSPENDED,
          suspendedAt: new Date(),
          suspensionReason: reason,
          underReview: false,
          isFeatured: false,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'vendor.suspend',
          entity: 'vendor',
          entityId: vendorId,
          summary: vendor.displayName,
          reason,
          before: { status: vendor.status },
          after: { status: VendorStatus.SUSPENDED },
        },
        tx,
      );
    });
    this.events.emit(VENDOR_EVENTS.STATUS_CHANGED, { vendorId, status: VendorStatus.SUSPENDED });
    return this.detail(vendorId);
  }

  async reinstate(vendorId: string, reason: string, actor: Actor) {
    const vendor = await this.vendor(vendorId);
    if (vendor.status !== VendorStatus.SUSPENDED)
      throw new ConflictException('Only suspended vendors can be reinstated');
    const kyc = await this.prisma.vendorKyc.findUnique({
      where: { vendorId },
      select: { status: true },
    });
    const next =
      kyc?.status === KycStatus.APPROVED || vendor.kycApprovedAt
        ? VendorStatus.ACTIVE
        : VendorStatus.PENDING;
    await this.prisma.$transaction(async (tx) => {
      await tx.vendor.update({
        where: { id: vendorId },
        data: { status: next, suspendedAt: null, suspensionReason: null },
      });
      await this.audit.log(
        actor,
        {
          action: 'vendor.reinstate',
          entity: 'vendor',
          entityId: vendorId,
          summary: vendor.displayName,
          reason,
          before: { status: vendor.status },
          after: { status: next },
        },
        tx,
      );
    });
    this.events.emit(VENDOR_EVENTS.STATUS_CHANGED, { vendorId, status: next });
    return this.detail(vendorId);
  }

  async setCommission(vendorId: string, dto: CommissionDto, actor: Actor) {
    const vendor = await this.vendor(vendorId);
    const bps = dto.commissionPercent === null ? null : Math.round(dto.commissionPercent * 100);
    await this.change(
      vendor,
      { commissionBps: bps },
      'vendor.commission',
      dto.reason,
      actor,
      { commissionPercent: vendor.commissionBps === null ? null : vendor.commissionBps / 100 },
      { commissionPercent: dto.commissionPercent },
    );
    return this.detail(vendorId);
  }

  async setVerified(vendorId: string, dto: ToggleDto, actor: Actor) {
    const vendor = await this.vendor(vendorId);
    if (dto.value && vendor.status !== VendorStatus.ACTIVE)
      throw new BadRequestException('Only active vendors can get the Verified badge');
    await this.change(
      vendor,
      { isVerified: dto.value },
      dto.value ? 'vendor.verify_badge' : 'vendor.remove_badge',
      dto.reason,
      actor,
      { isVerified: vendor.isVerified },
      { isVerified: dto.value },
    );
    return this.detail(vendorId);
  }

  async setPayoutHold(vendorId: string, dto: ToggleDto, actor: Actor) {
    const vendor = await this.vendor(vendorId);
    await this.change(
      vendor,
      { payoutsOnHold: dto.value, payoutHoldReason: dto.value ? dto.reason : null },
      dto.value ? 'vendor.hold_payouts' : 'vendor.release_payouts',
      dto.reason,
      actor,
      { payoutsOnHold: vendor.payoutsOnHold },
      { payoutsOnHold: dto.value },
    );
    return this.detail(vendorId);
  }

  async setUnderReview(vendorId: string, dto: ToggleDto, actor: Actor) {
    const vendor = await this.vendor(vendorId);
    await this.change(
      vendor,
      { underReview: dto.value },
      dto.value ? 'vendor.open_review' : 'vendor.close_review',
      dto.reason,
      actor,
      { underReview: vendor.underReview },
      { underReview: dto.value },
    );
    return this.detail(vendorId);
  }

  async addNote(vendorId: string, dto: NoteDto, actor: Actor, authorName: string) {
    const vendor = await this.vendor(vendorId);
    const kind = dto.kind ?? VendorNoteKind.NOTE;
    await this.prisma.$transaction(async (tx) => {
      await tx.vendorNote.create({
        data: { vendorId, kind, body: dto.body, authorId: actor.id, authorName },
      });
      await this.audit.log(
        actor,
        {
          action: kind === VendorNoteKind.WARNING ? 'vendor.warn' : 'vendor.note',
          entity: 'vendor',
          entityId: vendorId,
          summary: vendor.displayName,
          reason: dto.body,
        },
        tx,
      );
    });
    return this.detail(vendorId);
  }

  /** Lifetime GMV (paise) of each vendor, excluding cancelled sub-orders. */
  private async gmvFor(ids: string[]): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.subOrder.groupBy({
      by: ['vendorId'],
      where: { vendorId: { in: ids }, status: { not: SubOrderStatus.CANCELLED } },
      _sum: { totalPaise: true },
    });
    return new Map(rows.map((row) => [row.vendorId, row._sum.totalPaise ?? 0]));
  }

  private nameMatch(panName: string | null, bankName: string | null): boolean | null {
    if (!panName || !bankName) return null;
    const a = normaliseName(panName);
    const b = normaliseName(bankName);
    return Boolean(a) && (a === b || a.includes(b) || b.includes(a));
  }

  private async vendor(id: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { id, deletedAt: null } });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  private async kycFor(vendorId: string, allowed: KycStatus[]) {
    const kyc = await this.prisma.vendorKyc.findUnique({
      where: { vendorId },
      include: { vendor: { select: { displayName: true, status: true } } },
    });
    if (!kyc) throw new NotFoundException('This vendor has not submitted KYC yet');
    if (!allowed.includes(kyc.status))
      throw new ConflictException(`KYC is ${kyc.status.toLowerCase().replace(/_/g, ' ')}`);
    return kyc;
  }

  private async change(
    vendor: { id: string; displayName: string },
    data: Prisma.VendorUpdateInput,
    action: string,
    reason: string,
    actor: Actor,
    before: unknown,
    after: unknown,
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.vendor.update({ where: { id: vendor.id }, data });
      await this.audit.log(
        actor,
        {
          action,
          entity: 'vendor',
          entityId: vendor.id,
          summary: vendor.displayName,
          reason,
          before,
          after,
        },
        tx,
      );
    });
  }
}
