import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  ReportStatus,
  ReportTarget,
  ReporterKind,
  ReviewStatus,
  SubOrderStatus,
  VendorNoteKind,
} from '@prisma/client';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateReportDto,
  FlaggedReviewsQuery,
  ReportAction,
  ReportActionDto,
  ReportsQuery,
  ReviewActionDto,
} from './dto';

const DELIVERED: SubOrderStatus[] = [
  SubOrderStatus.DELIVERED,
  SubOrderStatus.RETURN_REQUESTED,
  SubOrderStatus.RETURNED,
];

/** Trust and safety (5.8): review moderation with fraud signals, and reported listings. */
@Injectable()
export class AdminTrustService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async flaggedReviews(query: FlaggedReviewsQuery) {
    const reported = await this.prisma.contentReport.findMany({
      where: { status: ReportStatus.OPEN, targetType: ReportTarget.REVIEW },
      select: { targetId: true },
    });
    const reportedIds = [...new Set(reported.map((r) => r.targetId))];
    const view = query.view ?? 'all';
    const where: Prisma.ReviewWhereInput =
      view === 'held'
        ? { status: ReviewStatus.UNDER_MODERATION }
        : view === 'reported'
          ? { id: { in: reportedIds } }
          : { OR: [{ status: ReviewStatus.UNDER_MODERATION }, { id: { in: reportedIds } }] };
    const reviews = await this.prisma.review.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: 100,
      include: {
        user: { select: { id: true, fullName: true, createdAt: true } },
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            vendor: { select: { id: true, displayName: true } },
          },
        },
        orderItem: { select: { subOrder: { select: { status: true, deliveredAt: true } } } },
        _count: { select: { media: true } },
      },
    });
    const reportCounts = new Map<string, number>();
    for (const r of reported) reportCounts.set(r.targetId, (reportCounts.get(r.targetId) ?? 0) + 1);

    const items = await Promise.all(
      reviews.map(async (review) => {
        const dayBefore = new Date(review.createdAt.getTime() - 86_400_000);
        const hourBefore = new Date(review.createdAt.getTime() - 3_600_000);
        const [sameDevice, userBurst, productBurst] = await Promise.all([
          review.deviceHash
            ? this.prisma.review.count({
                where: { deviceHash: review.deviceHash, userId: { not: review.userId } },
              })
            : Promise.resolve(0),
          this.prisma.review.count({
            where: { userId: review.userId, createdAt: { gte: dayBefore, lte: review.createdAt } },
          }),
          this.prisma.review.count({
            where: {
              productId: review.productId,
              createdAt: { gte: hourBefore, lte: review.createdAt },
            },
          }),
        ]);
        const signals: string[] = [];
        if (sameDevice > 0)
          signals.push(
            `Same device as ${sameDevice} review${sameDevice > 1 ? 's' : ''} by other accounts`,
          );
        if (userBurst >= 3) signals.push(`${userBurst} reviews by this customer in 24 hours`);
        if (productBurst >= 5)
          signals.push(`${productBurst} reviews on this product within an hour`);
        if (!DELIVERED.includes(review.orderItem.subOrder.status))
          signals.push('Unverified purchase: the item was not delivered');
        if (Date.now() - review.user.createdAt.getTime() < 3 * 86_400_000)
          signals.push('Account is less than 3 days old');
        return {
          id: review.id,
          rating: review.rating,
          title: review.title,
          body: review.body,
          status: review.status,
          flags: review.moderationFlags,
          signals,
          reports: reportCounts.get(review.id) ?? 0,
          media: review._count.media,
          createdAt: review.createdAt,
          author: { id: review.user.id, name: review.user.fullName },
          product: review.product,
        };
      }),
    );
    return { items };
  }

  async reviewAction(id: string, dto: ReviewActionDto, actor: Actor) {
    const review = await this.prisma.review.findUnique({
      where: { id },
      include: { product: { select: { name: true } } },
    });
    if (!review) throw new NotFoundException('Review not found');
    await this.prisma.$transaction(async (tx) => {
      await this.applyReview(
        tx,
        review.id,
        dto.action === 'publish' ? 'publish' : 'remove',
        dto.reason,
      );
      await tx.contentReport.updateMany({
        where: { targetType: ReportTarget.REVIEW, targetId: id, status: ReportStatus.OPEN },
        data: {
          status: ReportStatus.ACTIONED,
          action: `${dto.action}_review`,
          resolutionNote: dto.reason,
          handledById: actor.id,
          handledAt: new Date(),
        },
      });
      await this.audit.log(
        actor,
        {
          action: `review.${dto.action}`,
          entity: 'review',
          entityId: id,
          summary: `${review.title} · ${review.product.name}`,
          reason: dto.reason,
          before: { status: review.status },
          after: {
            status: dto.action === 'publish' ? ReviewStatus.PUBLISHED : ReviewStatus.REJECTED,
          },
        },
        tx,
      );
    });
    return {
      id,
      status: dto.action === 'publish' ? ReviewStatus.PUBLISHED : ReviewStatus.REJECTED,
    };
  }

  async reports(query: ReportsQuery) {
    const rows = await this.prisma.contentReport.findMany({
      where: {
        status: query.status ?? ReportStatus.OPEN,
        ...(query.targetType ? { targetType: query.targetType } : {}),
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });
    const ids = (type: ReportTarget) => [
      ...new Set(rows.filter((r) => r.targetType === type).map((r) => r.targetId)),
    ];
    const reporterIds = [
      ...new Set(rows.map((r) => r.reporterId).filter((x): x is string => Boolean(x))),
    ];
    const [products, reviews, vendors, reporters] = await Promise.all([
      this.prisma.product.findMany({
        where: { id: { in: ids(ReportTarget.PRODUCT) } },
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          imageUrl: true,
          pricePaise: true,
          vendor: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.review.findMany({
        where: { id: { in: ids(ReportTarget.REVIEW) } },
        select: {
          id: true,
          title: true,
          body: true,
          rating: true,
          status: true,
          product: {
            select: { name: true, slug: true, vendor: { select: { id: true, displayName: true } } },
          },
        },
      }),
      this.prisma.vendor.findMany({
        where: { id: { in: ids(ReportTarget.VENDOR) } },
        select: { id: true, displayName: true, status: true, trustScore: true },
      }),
      this.prisma.user.findMany({
        where: { id: { in: reporterIds } },
        select: { id: true, fullName: true },
      }),
    ]);
    const byId = new Map<string, unknown>(
      [...products, ...reviews, ...vendors].map((x): [string, unknown] => [x.id, x]),
    );
    const names = new Map(reporters.map((u) => [u.id, u.fullName]));
    const sameTarget = new Map<string, number>();
    for (const r of rows) sameTarget.set(r.targetId, (sameTarget.get(r.targetId) ?? 0) + 1);
    return {
      items: rows.map((r) => ({
        id: r.id,
        targetType: r.targetType,
        targetId: r.targetId,
        target: byId.get(r.targetId) ?? null,
        reason: r.reason,
        details: r.details,
        reporter: {
          kind: r.reporterKind,
          name: r.reporterId ? (names.get(r.reporterId) ?? 'Unknown') : 'System',
        },
        status: r.status,
        action: r.action,
        resolutionNote: r.resolutionNote,
        reportsOnTarget: sameTarget.get(r.targetId) ?? 1,
        createdAt: r.createdAt,
        handledAt: r.handledAt,
      })),
    };
  }

  async reportAction(id: string, dto: ReportActionDto, actor: Actor, actorName: string) {
    const report = await this.prisma.contentReport.findUnique({ where: { id } });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.OPEN)
      throw new ConflictException('This report was already handled');
    this.assertActionFits(report.targetType, dto.action);

    await this.prisma.$transaction(async (tx) => {
      let summary = '';
      switch (dto.action) {
        case 'publish_review':
        case 'remove_review': {
          const review = await this.applyReview(
            tx,
            report.targetId,
            dto.action === 'publish_review' ? 'publish' : 'remove',
            dto.note,
          );
          summary = review.title;
          break;
        }
        case 'delist_product': {
          const product = await tx.product.update({
            where: { id: report.targetId },
            data: { status: ProductStatus.INACTIVE, rejectionReason: dto.note },
          });
          summary = product.name;
          break;
        }
        case 'warn_vendor':
        case 'open_suspension_review': {
          const vendorId = await this.vendorOf(tx, report.targetType, report.targetId);
          const vendor = await tx.vendor.update({
            where: { id: vendorId },
            data: dto.action === 'open_suspension_review' ? { underReview: true } : {},
          });
          await tx.vendorNote.create({
            data: {
              vendorId,
              kind: VendorNoteKind.WARNING,
              authorId: actor.id,
              authorName: actorName,
              body: `${dto.action === 'warn_vendor' ? 'Warning' : 'Suspension review opened'} after a ${report.reason.toLowerCase().replace(/_/g, ' ')} report: ${dto.note}`,
            },
          });
          summary = vendor.displayName;
          break;
        }
        case 'dismiss':
          summary = 'Dismissed';
          break;
      }
      // Handle every open report on the same target together.
      await tx.contentReport.updateMany({
        where: {
          targetType: report.targetType,
          targetId: report.targetId,
          status: ReportStatus.OPEN,
        },
        data: {
          status: dto.action === 'dismiss' ? ReportStatus.DISMISSED : ReportStatus.ACTIONED,
          action: dto.action,
          resolutionNote: dto.note,
          handledById: actor.id,
          handledAt: new Date(),
        },
      });
      await this.audit.log(
        actor,
        {
          action: `report.${dto.action}`,
          entity: report.targetType.toLowerCase(),
          entityId: report.targetId,
          summary,
          reason: dto.note,
          after: { reportId: id, reason: report.reason },
        },
        tx,
      );
    });
    return this.reports({ status: ReportStatus.OPEN });
  }

  /** Storefront: a signed-in customer reports a product or a review. */
  async createReport(userId: string, dto: CreateReportDto) {
    const exists =
      dto.targetType === ReportTarget.PRODUCT
        ? await this.prisma.product.count({ where: { id: dto.targetId, deletedAt: null } })
        : await this.prisma.review.count({ where: { id: dto.targetId } });
    if (!exists) throw new NotFoundException('We couldn’t find what you are reporting');
    const open = await this.prisma.contentReport.findFirst({
      where: { reporterId: userId, targetId: dto.targetId, status: ReportStatus.OPEN },
    });
    if (open)
      return {
        id: open.id,
        message: 'Thanks, we already have your report and are looking into it.',
      };
    const report = await this.prisma.contentReport.create({
      data: {
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason: dto.reason,
        details: dto.details ?? null,
        reporterId: userId,
        reporterKind: ReporterKind.CUSTOMER,
      },
    });
    return {
      id: report.id,
      message: 'Thanks for telling us. Our trust and safety team will review it.',
    };
  }

  private assertActionFits(target: ReportTarget, action: ReportAction) {
    const allowed: Record<ReportTarget, ReportAction[]> = {
      REVIEW: ['dismiss', 'publish_review', 'remove_review', 'warn_vendor'],
      PRODUCT: ['dismiss', 'delist_product', 'warn_vendor', 'open_suspension_review'],
      VENDOR: ['dismiss', 'warn_vendor', 'open_suspension_review'],
    };
    if (!allowed[target].includes(action))
      throw new BadRequestException({
        statusCode: 400,
        message: 'That action doesn’t apply to this report',
        field: 'action',
      });
  }

  private async vendorOf(
    tx: Prisma.TransactionClient,
    target: ReportTarget,
    id: string,
  ): Promise<string> {
    if (target === ReportTarget.VENDOR) return id;
    if (target === ReportTarget.PRODUCT)
      return (await tx.product.findUniqueOrThrow({ where: { id }, select: { vendorId: true } }))
        .vendorId;
    const review = await tx.review.findUniqueOrThrow({
      where: { id },
      select: { product: { select: { vendorId: true } } },
    });
    return review.product.vendorId;
  }

  /** Publishes or removes a review and recalculates the product's rating from published reviews. */
  private async applyReview(
    tx: Prisma.TransactionClient,
    id: string,
    action: 'publish' | 'remove',
    reason: string,
  ) {
    const review = await tx.review.findUniqueOrThrow({ where: { id } });
    const publish = action === 'publish';
    const updated = await tx.review.update({
      where: { id },
      data: publish
        ? {
            status: ReviewStatus.PUBLISHED,
            publishedAt: review.publishedAt ?? new Date(),
            countedRating: review.rating,
            rejectionReason: null,
          }
        : { status: ReviewStatus.REJECTED, countedRating: null, rejectionReason: reason },
    });
    const stats = await tx.review.aggregate({
      where: { productId: review.productId, status: ReviewStatus.PUBLISHED },
      _avg: { rating: true },
      _count: { _all: true },
    });
    await tx.product.update({
      where: { id: review.productId },
      data: {
        ratingCount: stats._count._all,
        ratingAvg: Math.round((stats._avg.rating ?? 0) * 100) / 100,
      },
    });
    return updated;
  }
}
