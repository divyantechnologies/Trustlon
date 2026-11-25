import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessVerificationStatus,
  PaymentMethod,
  Prisma,
  ReturnStatus,
  SubOrderStatus,
  UserRole,
  UserStatus,
  WalletEntrySource,
  WalletEntryType,
} from '@prisma/client';
import { skip } from '../../../middlewares/admin/admin-query';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { EXPORT_LIMIT, toCsv } from '../../../middlewares/admin/csv';
import { toPage } from '../../../utils/http/pagination';
import { PrismaService } from '../../../database/prisma.service';
import { SessionService } from '../../auth/services/session.service';
import {
  B2bDecisionDto,
  CodDto,
  CustomerListQuery,
  CustomerStatusDto,
  WalletAdjustmentDto,
} from './dto';

interface Totals {
  orders: number;
  ltv: number;
}

/** Customer management (5.6). Wallet changes always create ledger entries with a reason. */
@Injectable()
export class AdminCustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sessions: SessionService,
  ) {}

  async list(query: CustomerListQuery) {
    const q = query.q?.trim();
    const digits = q?.replace(/\D/g, '') ?? '';
    const where: Prisma.UserWhereInput = {
      role: UserRole.CUSTOMER,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.codDisabled !== undefined ? { codDisabled: query.codDisabled } : {}),
      ...(query.b2b === true
        ? { businessProfile: { isNot: null } }
        : query.b2b === false
          ? { businessProfile: { is: null } }
          : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: 'insensitive' } },
              { email: { contains: q.toLowerCase() } },
              ...(digits.length >= 4 ? [{ mobile: { contains: digits.slice(-10) } }] : []),
              { referralCode: { equals: q.toUpperCase() } },
            ],
          }
        : {}),
    };
    const csv = query.format === 'csv';
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: csv ? 0 : skip(query),
        take: csv ? EXPORT_LIMIT : query.pageSize,
        select: {
          id: true,
          fullName: true,
          mobile: true,
          email: true,
          status: true,
          codDisabled: true,
          createdAt: true,
          lastLoginAt: true,
          businessProfile: { select: { status: true } },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    const totals = await this.totals(rows.map((row) => row.id));
    const items = rows.map((user) => ({
      id: user.id,
      fullName: user.fullName,
      mobile: user.mobile,
      email: user.email,
      status: user.status,
      codDisabled: user.codDisabled,
      b2b: user.businessProfile?.status ?? null,
      orders: totals.get(user.id)?.orders ?? 0,
      lifetimeValuePaise: totals.get(user.id)?.ltv ?? 0,
      joinedAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    }));
    if (csv) {
      return toCsv(
        [
          'Name',
          'Mobile',
          'Email',
          'Status',
          'Orders',
          'Lifetime value (Rs)',
          'B2B',
          'COD disabled',
          'Joined',
        ],
        items.map((c) => [
          c.fullName,
          c.mobile,
          c.email,
          c.status,
          c.orders,
          (c.lifetimeValuePaise / 100).toFixed(2),
          c.b2b ?? '',
          c.codDisabled ? 'Yes' : 'No',
          c.joinedAt.toISOString().slice(0, 10),
        ]),
      );
    }
    return toPage(items, total, query.page, query.pageSize);
  }

  async detail(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: UserRole.CUSTOMER },
      include: {
        businessProfile: true,
        wallet: true,
        primeMembership: true,
        _count: {
          select: { addresses: true, reviews: true, supportTickets: true, returnRequests: true },
        },
      },
    });
    if (!user) throw new NotFoundException('Customer not found');
    const [totals, orders, returns, entries, tickets, risk] = await Promise.all([
      this.totals([id]),
      this.prisma.order.findMany({
        where: { userId: id },
        orderBy: { placedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          orderNumber: true,
          placedAt: true,
          totalPaise: true,
          paymentMethod: true,
          paymentStatus: true,
          subOrders: { select: { status: true } },
        },
      }),
      this.prisma.returnRequest.findMany({
        where: { userId: id },
        orderBy: { requestedAt: 'desc' },
        take: 10,
        select: {
          id: true,
          returnNumber: true,
          status: true,
          reason: true,
          refundAmountPaise: true,
          requestedAt: true,
        },
      }),
      this.prisma.walletEntry.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 15,
      }),
      this.prisma.supportTicket.findMany({
        where: { userId: id },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          ticketNumber: true,
          subject: true,
          status: true,
          category: true,
          createdAt: true,
        },
      }),
      this.risk(id, user.createdAt),
    ]);
    return {
      id: user.id,
      fullName: user.fullName,
      mobile: user.mobile,
      email: user.email,
      status: user.status,
      blockedReason: user.blockedReason,
      codDisabled: user.codDisabled,
      preferredLanguage: user.preferredLanguage,
      joinedAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      mobileVerified: Boolean(user.mobileVerifiedAt),
      emailVerified: Boolean(user.emailVerifiedAt),
      counts: { ...user._count, orders: totals.get(id)?.orders ?? 0 },
      lifetimeValuePaise: totals.get(id)?.ltv ?? 0,
      prime: user.primeMembership
        ? { plan: user.primeMembership.plan, endsAt: user.primeMembership.endsAt }
        : null,
      b2b: user.businessProfile,
      wallet: {
        balancePaise: user.wallet?.balancePaise ?? 0,
        coins: user.wallet?.coins ?? 0,
        entries: entries.map((e) => ({
          id: e.id,
          type: e.type,
          source: e.source,
          amountPaise: e.amountPaise,
          coins: e.coins,
          description: e.description,
          at: e.createdAt,
        })),
      },
      orders: orders.map((o) => ({
        ...o,
        statuses: [...new Set(o.subOrders.map((s) => s.status))],
        subOrders: undefined,
      })),
      returns,
      tickets,
      risk,
    };
  }

  async setStatus(id: string, dto: CustomerStatusDto, actor: Actor) {
    const user = await this.customer(id);
    if (user.status === dto.status)
      throw new ConflictException(`This account is already ${dto.status.toLowerCase()}`);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id },
        data: {
          status: dto.status,
          blockedReason: dto.status === UserStatus.BLOCKED ? dto.reason : null,
        },
      });
      await this.audit.log(
        actor,
        {
          action: dto.status === UserStatus.BLOCKED ? 'customer.block' : 'customer.unblock',
          entity: 'customer',
          entityId: id,
          summary: user.fullName,
          reason: dto.reason,
          before: { status: user.status },
          after: { status: dto.status },
        },
        tx,
      );
    });
    // Blocking signs the customer out everywhere.
    if (dto.status === UserStatus.BLOCKED) await this.sessions.revokeAllForUser(id, 'blocked');
    return this.detail(id);
  }

  async setCod(id: string, dto: CodDto, actor: Actor) {
    const user = await this.customer(id);
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { codDisabled: dto.disabled } });
      await this.audit.log(
        actor,
        {
          action: dto.disabled ? 'customer.cod_disable' : 'customer.cod_enable',
          entity: 'customer',
          entityId: id,
          summary: user.fullName,
          reason: dto.reason,
          before: { codDisabled: user.codDisabled },
          after: { codDisabled: dto.disabled },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async decideB2b(id: string, dto: B2bDecisionDto, actor: Actor) {
    const user = await this.customer(id);
    const profile = await this.prisma.businessProfile.findUnique({ where: { userId: id } });
    if (!profile) throw new NotFoundException('This customer has no B2B profile');
    if (dto.decision === BusinessVerificationStatus.REJECTED && !dto.reason) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Tell the customer why',
        field: 'reason',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.businessProfile.update({
        where: { userId: id },
        data: {
          status: dto.decision,
          verifiedAt: dto.decision === BusinessVerificationStatus.VERIFIED ? new Date() : null,
          rejectionReason: dto.decision === BusinessVerificationStatus.REJECTED ? dto.reason : null,
        },
      });
      await this.audit.log(
        actor,
        {
          action:
            dto.decision === BusinessVerificationStatus.VERIFIED
              ? 'customer.b2b_verify'
              : 'customer.b2b_reject',
          entity: 'customer',
          entityId: id,
          summary: `${user.fullName} · ${profile.gstin}`,
          reason: dto.reason,
          before: { status: profile.status },
          after: { status: dto.decision },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  async adjustWallet(id: string, dto: WalletAdjustmentDto, actor: Actor) {
    const user = await this.customer(id);
    const amountPaise = Math.round(dto.amountRupees * 100);
    const coins = dto.coins ?? 0;
    if (amountPaise === 0 && coins === 0)
      throw new BadRequestException({
        statusCode: 400,
        message: 'Enter an amount or coins',
        field: 'amountRupees',
      });
    await this.prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.upsert({
        where: { userId: id },
        create: { userId: id },
        update: {},
      });
      let balanceAfter: number;
      if (dto.direction === 'DEBIT') {
        const updated = await tx.wallet.updateMany({
          where: { userId: id, balancePaise: { gte: amountPaise }, coins: { gte: coins } },
          data: { balancePaise: { decrement: amountPaise }, coins: { decrement: coins } },
        });
        if (updated.count === 0) {
          throw new BadRequestException({
            statusCode: 400,
            message: `The wallet has only ₹${(wallet.balancePaise / 100).toFixed(2)} and ${wallet.coins} coins`,
            field: 'amountRupees',
          });
        }
        balanceAfter = wallet.balancePaise - amountPaise;
      } else {
        const updated = await tx.wallet.update({
          where: { userId: id },
          data: { balancePaise: { increment: amountPaise }, coins: { increment: coins } },
        });
        balanceAfter = updated.balancePaise;
      }
      await tx.walletEntry.create({
        data: {
          userId: id,
          type: dto.direction === 'DEBIT' ? WalletEntryType.DEBIT : WalletEntryType.CREDIT,
          source: WalletEntrySource.ADJUSTMENT,
          amountPaise,
          coins,
          balanceAfterPaise: balanceAfter,
          description: `Adjustment by Trustlon: ${dto.reason}`.slice(0, 160),
          coinsExpireAt:
            dto.direction === 'CREDIT' && coins > 0
              ? new Date(Date.now() + 365 * 86_400_000)
              : null,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'customer.wallet_adjustment',
          entity: 'customer',
          entityId: id,
          summary: user.fullName,
          reason: dto.reason,
          before: { balancePaise: wallet.balancePaise, coins: wallet.coins },
          after: { direction: dto.direction, amountPaise, coins, balancePaise: balanceAfter },
        },
        tx,
      );
    });
    return this.detail(id);
  }

  /** Orders placed and lifetime value (delivered or in progress, less refunds) per customer. */
  private async totals(ids: string[]): Promise<Map<string, Totals>> {
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.$queryRaw<
      Array<{ user_id: string; orders: number; ltv: bigint }>
    >`
      SELECT o.user_id::text AS user_id,
             COUNT(DISTINCT o.id)::int AS orders,
             COALESCE(SUM(CASE WHEN s.status <> 'CANCELLED' THEN s.total_paise - s.refund_paise ELSE 0 END), 0)::bigint AS ltv
      FROM orders o JOIN sub_orders s ON s.order_id = o.id
      WHERE o.user_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})
      GROUP BY o.user_id`;
    return new Map(rows.map((row) => [row.user_id, { orders: row.orders, ltv: Number(row.ltv) }]));
  }

  /** A simple 0–100 risk score with the signals behind it. */
  private async risk(userId: string, joinedAt: Date) {
    const [delivered, returns, codCancelled, recentOrders, rejectedReviews] = await Promise.all([
      this.prisma.subOrder.count({
        where: {
          order: { userId },
          status: {
            in: [
              SubOrderStatus.DELIVERED,
              SubOrderStatus.RETURN_REQUESTED,
              SubOrderStatus.RETURNED,
            ],
          },
        },
      }),
      this.prisma.returnRequest.count({
        where: { userId, status: { notIn: [ReturnStatus.CANCELLED, ReturnStatus.REJECTED] } },
      }),
      this.prisma.subOrder.count({
        where: {
          order: { userId, paymentMethod: PaymentMethod.COD },
          status: SubOrderStatus.CANCELLED,
        },
      }),
      this.prisma.order.count({
        where: { userId, placedAt: { gte: new Date(Date.now() - 7 * 86_400_000) } },
      }),
      this.prisma.review.count({ where: { userId, status: 'REJECTED' } }),
    ]);
    const signals: Array<{ label: string; points: number }> = [];
    const returnRate = delivered ? returns / delivered : 0;
    if (delivered >= 3 && returnRate > 0.3)
      signals.push({ label: `High return rate (${Math.round(returnRate * 100)}%)`, points: 30 });
    if (codCancelled >= 2)
      signals.push({ label: `${codCancelled} cash on delivery orders cancelled`, points: 25 });
    if (Date.now() - joinedAt.getTime() < 7 * 86_400_000 && recentOrders >= 5)
      signals.push({ label: `${recentOrders} orders in the first week`, points: 20 });
    if (rejectedReviews >= 2)
      signals.push({ label: `${rejectedReviews} reviews removed by moderators`, points: 15 });
    const score = Math.min(
      100,
      signals.reduce((sum, s) => sum + s.points, 0),
    );
    return { score, level: score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low', signals };
  }

  private async customer(id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, role: UserRole.CUSTOMER, deletedAt: null },
    });
    if (!user) throw new NotFoundException('Customer not found');
    return user;
  }
}
