import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, ReviewMediaKind, ReviewStatus, SubOrderStatus } from '@prisma/client';
import { createHash, randomUUID } from 'crypto';
import { detectFileType, FileStorage } from '../../common/storage/file-storage';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto, MAX_REVIEW_PHOTOS, MAX_REVIEW_VIDEOS, UpdateReviewDto } from './dto';
import { normaliseReviewText, runReviewChecks } from './review-checks';

export const REVIEW_SUBMITTED = 'review.submitted';

const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const MAX_REVIEW_UPLOAD_BYTES = 30 * 1024 * 1024;
const MAX_DAILY_UPLOADS = 30;

/** Delivered items can be reviewed; returned items cannot. */
const REVIEWABLE_STATUSES: SubOrderStatus[] = [
  SubOrderStatus.DELIVERED,
  SubOrderStatus.RETURN_REQUESTED,
];

export interface UploadedFileData {
  buffer: Buffer;
  size: number;
}

export interface PendingReview {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  deliveredAt: Date | null;
  product: { id: string; slug: string; name: string; image: string; brand: string | null };
}

export interface MyReview {
  id: string;
  status: ReviewStatus;
  rating: number;
  title: string;
  body: string;
  rejectionReason: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
  orderItemId: string;
  orderNumber: string;
  product: { id: string; slug: string; name: string; image: string };
  media: Array<{ id: string; kind: ReviewMediaKind }>;
}

const reviewInclude = {
  product: { select: { id: true, slug: true, name: true, imageUrl: true } },
  orderItem: { select: { subOrder: { select: { order: { select: { orderNumber: true } } } } } },
  media: { select: { id: true, kind: true }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.ReviewInclude;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

function toMyReview(row: ReviewRow): MyReview {
  return {
    id: row.id,
    status: row.status,
    rating: row.rating,
    title: row.title,
    body: row.body,
    rejectionReason: row.rejectionReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
    orderItemId: row.orderItemId,
    orderNumber: row.orderItem.subOrder.order.orderNumber,
    product: {
      id: row.product.id,
      slug: row.product.slug,
      name: row.product.name,
      image: row.product.imageUrl,
    },
    media: row.media.map((m) => ({ id: m.id, kind: m.kind })),
  };
}

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly events: EventEmitter2,
  ) {}

  async mine(userId: string): Promise<{ pending: PendingReview[]; reviews: MyReview[] }> {
    const [items, reviews] = await Promise.all([
      this.prisma.orderItem.findMany({
        where: {
          review: { is: null },
          productId: { not: null },
          subOrder: { status: { in: REVIEWABLE_STATUSES }, order: { userId } },
        },
        include: {
          subOrder: {
            select: { deliveredAt: true, order: { select: { id: true, orderNumber: true } } },
          },
        },
        orderBy: { subOrder: { deliveredAt: 'desc' } },
        take: 50,
      }),
      this.prisma.review.findMany({
        where: { userId },
        include: reviewInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);
    return {
      pending: items.map((item) => ({
        orderItemId: item.id,
        orderId: item.subOrder.order.id,
        orderNumber: item.subOrder.order.orderNumber,
        deliveredAt: item.subOrder.deliveredAt,
        product: {
          id: item.productId as string,
          slug: item.productSlug,
          name: item.productName,
          image: item.imageUrl,
          brand: item.brand,
        },
      })),
      reviews: reviews.map(toMyReview),
    };
  }

  /** `meta` (IP and browser) feeds the same-device fraud signal in Trust and safety (5.8). */
  async create(
    userId: string,
    dto: CreateReviewDto,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<MyReview> {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: dto.orderItemId, subOrder: { order: { userId } } },
      include: { subOrder: { select: { status: true } }, review: { select: { id: true } } },
    });
    if (!item) throw new NotFoundException('Order item not found');
    if (!REVIEWABLE_STATUSES.includes(item.subOrder.status)) {
      throw new ConflictException('You can review a product once it has been delivered to you.');
    }
    if (item.review)
      throw new ConflictException('You have already reviewed this item. Edit your review instead.');
    if (!item.productId)
      throw new ConflictException('This product is no longer sold, so it cannot be reviewed.');
    const product = await this.prisma.product.findUnique({
      where: { id: item.productId },
      select: { id: true },
    });
    if (!product)
      throw new ConflictException('This product is no longer sold, so it cannot be reviewed.');

    const flags = await this.check(userId, dto.rating, dto.title, dto.body);
    const status = flags.length ? ReviewStatus.UNDER_MODERATION : ReviewStatus.PUBLISHED;
    const now = new Date();

    const id = await this.prisma.$transaction(async (tx) => {
      const review = await tx.review.create({
        data: {
          userId,
          productId: product.id,
          orderItemId: item.id,
          rating: dto.rating,
          title: dto.title,
          body: dto.body,
          status,
          moderationFlags: flags,
          publishedAt: status === ReviewStatus.PUBLISHED ? now : null,
          countedRating: status === ReviewStatus.PUBLISHED ? dto.rating : null,
          ip: meta.ip?.slice(0, 45) ?? null,
          deviceHash: deviceHash(meta),
        },
        select: { id: true },
      });
      await this.attachMedia(tx, userId, review.id, dto.mediaIds);
      if (status === ReviewStatus.PUBLISHED)
        await this.adjustRating(tx, product.id, null, dto.rating);
      return review.id;
    });

    this.events.emit(REVIEW_SUBMITTED, { reviewId: id, userId, status });
    return this.one(userId, id);
  }

  async update(userId: string, id: string, dto: UpdateReviewDto): Promise<MyReview> {
    const existing = await this.prisma.review.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Review not found');

    const rating = dto.rating ?? existing.rating;
    const title = dto.title ?? existing.title;
    const body = dto.body ?? existing.body;
    const flags = await this.check(userId, rating, title, body, id);
    const status = flags.length ? ReviewStatus.UNDER_MODERATION : ReviewStatus.PUBLISHED;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id },
        data: {
          rating,
          title,
          body,
          status,
          moderationFlags: flags,
          rejectionReason: null,
          publishedAt: status === ReviewStatus.PUBLISHED ? (existing.publishedAt ?? now) : null,
          countedRating: status === ReviewStatus.PUBLISHED ? rating : null,
        },
      });
      if (dto.mediaIds) {
        const removed = await tx.reviewMedia.findMany({
          where: { reviewId: id, id: { notIn: dto.mediaIds } },
          select: { id: true, storageKey: true },
        });
        if (removed.length) {
          await tx.reviewMedia.deleteMany({ where: { id: { in: removed.map((m) => m.id) } } });
          await Promise.all(removed.map((m) => this.storage.remove(m.storageKey)));
        }
        const fresh = dto.mediaIds.filter((mediaId) => !removed.some((m) => m.id === mediaId));
        await this.attachMedia(tx, userId, id, fresh, true);
      }
      await this.adjustRating(
        tx,
        existing.productId,
        existing.countedRating,
        status === ReviewStatus.PUBLISHED ? rating : null,
      );
    });

    this.events.emit(REVIEW_SUBMITTED, { reviewId: id, userId, status });
    return this.one(userId, id);
  }

  async uploadMedia(
    userId: string,
    file: UploadedFileData | undefined,
  ): Promise<{ id: string; kind: ReviewMediaKind }> {
    if (!file?.buffer?.length)
      throw new BadRequestException({ message: 'Choose a photo or video', field: 'file' });
    const type = detectFileType(file.buffer);
    if (!type || type.kind === 'pdf') {
      throw new BadRequestException({
        message: 'Upload a JPG, PNG or WebP photo, or an MP4 video',
        field: 'file',
      });
    }
    if (type.kind === 'image' && file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException({ message: 'Photos must be 5 MB or smaller', field: 'file' });
    }
    if (file.size > MAX_REVIEW_UPLOAD_BYTES) {
      throw new BadRequestException({ message: 'Videos must be 30 MB or smaller', field: 'file' });
    }
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.reviewMedia.count({
      where: { userId, reviewId: null, createdAt: { gte: since } },
    });
    if (recent >= MAX_DAILY_UPLOADS) {
      throw new ConflictException(
        'Too many uploads today. Save your review or try again tomorrow.',
      );
    }

    const id = randomUUID();
    const kind = type.kind === 'video' ? ReviewMediaKind.VIDEO : ReviewMediaKind.PHOTO;
    const storageKey = `reviews/${userId}/${id}.${type.extension}`;
    await this.storage.put(storageKey, file.buffer);
    await this.prisma.reviewMedia.create({
      data: { id, userId, kind, storageKey, contentType: type.contentType, sizeBytes: file.size },
    });
    return { id, kind };
  }

  /** The author can always see their media; anyone can see media of a published review. */
  async media(
    viewerId: string | null,
    mediaId: string,
  ): Promise<{ content: Buffer; contentType: string }> {
    const media = await this.prisma.reviewMedia.findUnique({
      where: { id: mediaId },
      include: { review: { select: { status: true } } },
    });
    const visible =
      media && (media.userId === viewerId || media.review?.status === ReviewStatus.PUBLISHED);
    if (!media || !visible) throw new NotFoundException('File not found');
    return { content: await this.storage.read(media.storageKey), contentType: media.contentType };
  }

  private async one(userId: string, id: string): Promise<MyReview> {
    const row = await this.prisma.review.findFirst({
      where: { id, userId },
      include: reviewInclude,
    });
    if (!row) throw new NotFoundException('Review not found');
    return toMyReview(row);
  }

  private async check(
    userId: string,
    rating: number,
    title: string,
    body: string,
    excludeId?: string,
  ) {
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const [others, recentCount] = await Promise.all([
      this.prisma.review.findMany({
        where: { userId, ...(excludeId ? { id: { not: excludeId } } : {}) },
        select: { body: true },
        take: 200,
      }),
      this.prisma.review.count({
        where: {
          userId,
          updatedAt: { gte: since },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      }),
    ]);
    return runReviewChecks({
      rating,
      title,
      body,
      otherBodies: others.map((r) => normaliseReviewText(r.body)),
      recentCount,
    });
  }

  private async attachMedia(
    tx: Prisma.TransactionClient,
    userId: string,
    reviewId: string,
    mediaIds: string[],
    keepExisting = false,
  ): Promise<void> {
    if (mediaIds.length) {
      const attached = await tx.reviewMedia.updateMany({
        where: { id: { in: mediaIds }, userId, reviewId: null },
        data: { reviewId },
      });
      if (attached.count !== mediaIds.length) {
        throw new BadRequestException({
          message: 'One of the files could not be found. Upload it again.',
          field: 'mediaIds',
        });
      }
    }
    if (mediaIds.length || keepExisting) {
      const counts = await tx.reviewMedia.groupBy({
        by: ['kind'],
        where: { reviewId },
        _count: { _all: true },
      });
      const photos = counts.find((c) => c.kind === ReviewMediaKind.PHOTO)?._count._all ?? 0;
      const videos = counts.find((c) => c.kind === ReviewMediaKind.VIDEO)?._count._all ?? 0;
      if (photos > MAX_REVIEW_PHOTOS || videos > MAX_REVIEW_VIDEOS) {
        throw new BadRequestException({
          message: `Add up to ${MAX_REVIEW_PHOTOS} photos and ${MAX_REVIEW_VIDEOS} video`,
          field: 'mediaIds',
        });
      }
    }
  }

  /** Keeps the product's average exact: removes the old counted rating and adds the new one. */
  private async adjustRating(
    tx: Prisma.TransactionClient,
    productId: string,
    oldRating: number | null,
    newRating: number | null,
  ): Promise<void> {
    if (oldRating === newRating) return;
    const product = await tx.product.findUnique({
      where: { id: productId },
      select: { ratingAvg: true, ratingCount: true },
    });
    if (!product) return;
    let total = product.ratingAvg * product.ratingCount;
    let count = product.ratingCount;
    if (oldRating !== null && count > 0) {
      total -= oldRating;
      count -= 1;
    }
    if (newRating !== null) {
      total += newRating;
      count += 1;
    }
    await tx.product.update({
      where: { id: productId },
      data: {
        ratingCount: count,
        ratingAvg: count > 0 ? Math.round((total / count) * 100) / 100 : 0,
      },
    });
  }
}

/** Same browser on the same network range, without storing the user agent itself. */
function deviceHash(meta: { ip?: string; userAgent?: string }): string | null {
  if (!meta.ip && !meta.userAgent) return null;
  const ip = meta.ip ?? '';
  // IPv4: first three parts; IPv6: first four groups.
  const range = ip.includes(':')
    ? ip.split(':').slice(0, 4).join(':')
    : ip.split('.').slice(0, 3).join('.');
  return createHash('sha256')
    .update(`${range}|${meta.userAgent ?? ''}`)
    .digest('hex');
}
