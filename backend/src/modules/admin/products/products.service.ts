import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  AuthenticityStatus,
  Prisma,
  ProductStatus,
  SubmissionKind,
  SubmissionStatus,
  VendorStatus,
} from '@prisma/client';
import { skip } from '../../../middlewares/admin/admin-query';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { EXPORT_LIMIT, toCsv } from '../../../middlewares/admin/csv';
import { toPage } from '../../../utils/http/pagination';
import { PrismaService } from '../../../database/prisma.service';
import { SiteSettingsService } from '../../site/site-settings.service';
import { AuthenticityDto, ModerationQuery, ProductListQuery } from './dto';

export const PRODUCT_MODERATED = 'product.moderated';

/** Fields a vendor edit can change; anything else in a submission is ignored. */
const EDITABLE = [
  'name',
  'description',
  'brand',
  'imageUrl',
  'images',
  'pricePaise',
  'mrpPaise',
  'categoryId',
  'hsnCode',
  'codAllowed',
  'badge',
  'isBundle',
] as const;

interface Change {
  field: string;
  before: unknown;
  after: unknown;
}

const productInclude = {
  vendor: {
    select: { id: true, displayName: true, status: true, isVerified: true, trustScore: true },
  },
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductInclude;

/** Product moderation and the all-products table (5.4). */
@Injectable()
export class AdminProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly site: SiteSettingsService,
    private readonly events: EventEmitter2,
  ) {}

  async moderationQueue(query: ModerationQuery) {
    const threshold = (await this.site.get('business-rules')).authenticityCheckAboveRupees * 100;
    const [submissions, pendingProducts] = await Promise.all([
      this.prisma.productSubmission.findMany({
        where: { status: SubmissionStatus.PENDING, ...(query.kind ? { kind: query.kind } : {}) },
        orderBy: { submittedAt: 'asc' },
        take: 200,
        include: { product: { include: productInclude } },
      }),
      query.kind === SubmissionKind.EDIT
        ? Promise.resolve([])
        : this.prisma.product.findMany({
            where: {
              status: ProductStatus.PENDING_APPROVAL,
              deletedAt: null,
              submissions: { none: { status: SubmissionStatus.PENDING } },
            },
            orderBy: { createdAt: 'asc' },
            take: 200,
            include: productInclude,
          }),
    ]);
    const card = (product: Prisma.ProductGetPayload<{ include: typeof productInclude }>) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      imageUrl: product.imageUrl,
      pricePaise: product.pricePaise,
      mrpPaise: product.mrpPaise,
      status: product.status,
      authenticity: product.authenticity,
      needsAuthenticityCheck:
        product.pricePaise >= threshold && product.authenticity === AuthenticityStatus.NOT_REQUIRED,
      vendor: product.vendor,
      category: product.category,
    });
    const items = [
      ...submissions.map((s) => ({
        submissionId: s.id,
        kind: s.kind,
        submittedAt: s.submittedAt,
        changes: (s.changes as unknown as Change[]) ?? [],
        product: card(s.product),
      })),
      ...pendingProducts.map((p) => ({
        submissionId: null,
        kind: SubmissionKind.NEW,
        submittedAt: p.submittedAt ?? p.createdAt,
        changes: [] as Change[],
        product: card(p),
      })),
    ].sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime());
    return { items, authenticityThresholdPaise: threshold };
  }

  async list(query: ProductListQuery) {
    const where: Prisma.ProductWhereInput = {
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.authenticity ? { authenticity: query.authenticity } : {}),
      ...(query.q
        ? {
            OR: [
              { searchText: { contains: query.q.toLowerCase() } },
              { name: { contains: query.q, mode: 'insensitive' } },
              { slug: { contains: query.q.toLowerCase() } },
            ],
          }
        : {}),
    };
    const csv = query.format === 'csv';
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: csv ? 0 : skip(query),
        take: csv ? EXPORT_LIMIT : query.pageSize,
        include: productInclude,
      }),
      this.prisma.product.count({ where }),
    ]);
    const items = rows.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      brand: p.brand,
      imageUrl: p.imageUrl,
      status: p.status,
      pricePaise: p.pricePaise,
      mrpPaise: p.mrpPaise,
      stock: p.stock,
      authenticity: p.authenticity,
      ratingAvg: p.ratingAvg,
      salesCount: p.salesCount,
      vendor: p.vendor,
      category: p.category,
      updatedAt: p.updatedAt,
    }));
    if (csv) {
      return toCsv(
        [
          'Name',
          'Brand',
          'Vendor',
          'Category',
          'Status',
          'Price (Rs)',
          'MRP (Rs)',
          'Stock',
          'Sold',
          'Updated',
        ],
        items.map((p) => [
          p.name,
          p.brand,
          p.vendor.displayName,
          p.category.name,
          p.status,
          (p.pricePaise / 100).toFixed(2),
          (p.mrpPaise / 100).toFixed(2),
          p.stock,
          p.salesCount,
          p.updatedAt.toISOString().slice(0, 10),
        ]),
      );
    }
    return toPage(items, total, query.page, query.pageSize);
  }

  async detail(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, deletedAt: null },
      include: {
        ...productInclude,
        submissions: { orderBy: { submittedAt: 'desc' }, take: 20 },
      },
    });
    if (!product) throw new NotFoundException('Product not found');
    const threshold = (await this.site.get('business-rules')).authenticityCheckAboveRupees * 100;
    return {
      id: product.id,
      name: product.name,
      slug: product.slug,
      brand: product.brand,
      description: product.description,
      imageUrl: product.imageUrl,
      images: product.images,
      pricePaise: product.pricePaise,
      mrpPaise: product.mrpPaise,
      discountPercent: product.discountPercent,
      stock: product.stock,
      status: product.status,
      hsnCode: product.hsnCode,
      codAllowed: product.codAllowed,
      badge: product.badge,
      isBundle: product.isBundle,
      rejectionReason: product.rejectionReason,
      authenticity: product.authenticity,
      authenticityNote: product.authenticityNote,
      needsAuthenticityCheck:
        product.pricePaise >= threshold && product.authenticity === AuthenticityStatus.NOT_REQUIRED,
      ratingAvg: product.ratingAvg,
      ratingCount: product.ratingCount,
      salesCount: product.salesCount,
      submittedAt: product.submittedAt,
      approvedAt: product.approvedAt,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      vendor: product.vendor,
      category: product.category,
      submissions: product.submissions.map((s) => ({
        id: s.id,
        kind: s.kind,
        status: s.status,
        changes: s.changes,
        submittedAt: s.submittedAt,
        decidedAt: s.decidedAt,
        reason: s.reason,
      })),
    };
  }

  async approve(id: string, note: string | undefined, actor: Actor) {
    const product = await this.product(id);
    if (product.authenticity === AuthenticityStatus.FLAGGED) {
      throw new ConflictException('Finish the authenticity check before approving');
    }
    if (product.authenticity === AuthenticityStatus.FAILED) {
      throw new ConflictException('This product failed the authenticity check');
    }
    const vendor = await this.prisma.vendor.findUniqueOrThrow({
      where: { id: product.vendorId },
      select: { status: true },
    });
    const pending = await this.prisma.productSubmission.findFirst({
      where: { productId: id, status: SubmissionStatus.PENDING },
      orderBy: { submittedAt: 'desc' },
    });
    if (
      !pending &&
      !(
        [
          ProductStatus.PENDING_APPROVAL,
          ProductStatus.CHANGES_REQUESTED,
          ProductStatus.REJECTED,
        ] as ProductStatus[]
      ).includes(product.status)
    ) {
      throw new ConflictException('Nothing is waiting for approval on this product');
    }
    const data: Prisma.ProductUncheckedUpdateInput = {};
    if (pending?.kind === SubmissionKind.EDIT) {
      for (const change of (pending.changes as unknown as Change[]) ?? []) {
        if ((EDITABLE as readonly string[]).includes(change.field)) {
          (data as Record<string, unknown>)[change.field] = change.after;
        }
      }
      if (typeof data.pricePaise === 'number' || typeof data.mrpPaise === 'number') {
        const price = (data.pricePaise as number | undefined) ?? product.pricePaise;
        const mrp = (data.mrpPaise as number | undefined) ?? product.mrpPaise;
        if (price > mrp) throw new BadRequestException('The new price is above the MRP');
        data.discountPercent = mrp > 0 ? Math.max(0, Math.round(((mrp - price) / mrp) * 100)) : 0;
      }
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: { ...data, status: ProductStatus.LIVE, approvedAt: now, rejectionReason: null },
      });
      if (pending) {
        await tx.productSubmission.update({
          where: { id: pending.id },
          data: {
            status: SubmissionStatus.APPROVED,
            decidedAt: now,
            decidedById: actor.id,
            reason: note ?? null,
          },
        });
      }
      await this.audit.log(
        actor,
        {
          action:
            pending?.kind === SubmissionKind.EDIT ? 'product.approve_edit' : 'product.approve',
          entity: 'product',
          entityId: id,
          summary: product.name,
          reason: note,
          before: { status: product.status },
          after: { status: ProductStatus.LIVE, ...data },
        },
        tx,
      );
    });
    this.events.emit(PRODUCT_MODERATED, { productId: id, decision: 'approved' });
    return { ...(await this.detail(id)), vendorActive: vendor.status === VendorStatus.ACTIVE };
  }

  async reject(id: string, reason: string, actor: Actor) {
    return this.decide(id, reason, actor, 'reject');
  }

  async requestChanges(id: string, reason: string, actor: Actor) {
    return this.decide(id, reason, actor, 'changes');
  }

  async authenticity(id: string, dto: AuthenticityDto, actor: Actor) {
    const product = await this.product(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({
        where: { id },
        data: {
          authenticity: dto.status,
          authenticityNote: dto.note ?? dto.reason ?? null,
          ...(dto.status === AuthenticityStatus.FAILED ? { status: ProductStatus.INACTIVE } : {}),
        },
      });
      await this.audit.log(
        actor,
        {
          action: `product.authenticity_${dto.status.toLowerCase()}`,
          entity: 'product',
          entityId: id,
          summary: product.name,
          reason: dto.note ?? dto.reason,
          before: { authenticity: product.authenticity, status: product.status },
          after: { authenticity: dto.status },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async setActive(id: string, active: boolean, reason: string, actor: Actor) {
    const product = await this.product(id);
    if (active) {
      if (product.status !== ProductStatus.INACTIVE)
        throw new ConflictException('Only inactive products can be reactivated');
      if (product.authenticity === AuthenticityStatus.FAILED)
        throw new ConflictException('This product failed the authenticity check');
    } else if (product.status === ProductStatus.INACTIVE) {
      throw new ConflictException('This product is already inactive');
    }
    const status = active ? ProductStatus.LIVE : ProductStatus.INACTIVE;
    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id }, data: { status } });
      await this.audit.log(
        actor,
        {
          action: active ? 'product.reactivate' : 'product.deactivate',
          entity: 'product',
          entityId: id,
          summary: product.name,
          reason,
          before: { status: product.status },
          after: { status },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  private async decide(id: string, reason: string, actor: Actor, decision: 'reject' | 'changes') {
    const product = await this.product(id);
    const pending = await this.prisma.productSubmission.findFirst({
      where: { productId: id, status: SubmissionStatus.PENDING },
      orderBy: { submittedAt: 'desc' },
    });
    if (!pending && product.status !== ProductStatus.PENDING_APPROVAL) {
      throw new ConflictException('Nothing is waiting for approval on this product');
    }
    // An edit to a live product is turned down on its own; the product stays live.
    const editOfLive =
      pending?.kind === SubmissionKind.EDIT && product.status === ProductStatus.LIVE;
    const status = decision === 'reject' ? ProductStatus.REJECTED : ProductStatus.CHANGES_REQUESTED;
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      if (!editOfLive)
        await tx.product.update({ where: { id }, data: { status, rejectionReason: reason } });
      if (pending) {
        await tx.productSubmission.update({
          where: { id: pending.id },
          data: {
            status:
              decision === 'reject'
                ? SubmissionStatus.REJECTED
                : SubmissionStatus.CHANGES_REQUESTED,
            decidedAt: now,
            decidedById: actor.id,
            reason,
          },
        });
      }
      await this.audit.log(
        actor,
        {
          action: decision === 'reject' ? 'product.reject' : 'product.request_changes',
          entity: 'product',
          entityId: id,
          summary: product.name,
          reason,
          before: { status: product.status },
          after: { status: editOfLive ? product.status : status },
        },
        tx,
      );
    });
    this.events.emit(PRODUCT_MODERATED, { productId: id, decision, reason });
    return this.detail(id);
  }

  private async product(id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, deletedAt: null } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }
}
