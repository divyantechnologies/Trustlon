import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PaymentStatus,
  Prisma,
  ReturnRefundMethod,
  ReturnStatus,
  SubOrderStatus,
  WalletEntrySource,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { Page, toPage } from '../../common/http/pagination';
import { detectImageType, FileStorage } from '../../common/storage/file-storage';
import { PrismaService } from '../../prisma/prisma.service';
import { AddressesService, toAddressSnapshot } from '../addresses/addresses.service';
import { ShippingAddress, toShippingAddress } from '../orders/order.presenter';
import { WalletService } from '../wallet/wallet.service';
import { CreateReturnDto, MAX_RETURN_PHOTOS, ReturnListQueryDto } from './dto';
import {
  CUSTOMER_CANCELLABLE,
  OPEN_OR_DONE_STATUSES,
  OPEN_STATUSES,
  PHOTO_REQUIRED_REASONS,
  RETURN_EVENT_TITLES,
  RETURN_REASON_LABELS,
  RETURN_TRANSITIONS,
  RETURNABLE_SUB_ORDER_STATUSES,
  refundMethodsFor,
  returnNumber,
} from './return-rules';
import {
  refundDestinationFor,
  ReturnDetail,
  returnInclude,
  ReturnSummary,
  toReturnDetail,
  toReturnSummary,
} from './return.presenter';

export const RETURN_REQUESTED_EVENT = 'return.requested';
export const RETURN_STATUS_CHANGED_EVENT = 'return.status-changed';

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
/** Unattached uploads allowed per customer per day, to stop storage abuse. */
const MAX_DAILY_UPLOADS = 30;

export interface UploadedImage {
  buffer: Buffer;
  size: number;
}

export interface ReturnEligibility {
  subOrderId: string;
  subOrderNumber: string;
  order: { id: string; orderNumber: string };
  seller: { slug: string; name: string };
  eligible: boolean;
  /** Why the items cannot be returned, when `eligible` is false. */
  reason: string | null;
  returnEligibleUntil: Date | null;
  items: Array<{
    orderItemId: string;
    name: string;
    image: string;
    brand: string | null;
    orderedQuantity: number;
    returnableQuantity: number;
    unitPricePaise: number;
  }>;
  refundMethods: Array<{ method: ReturnRefundMethod; destination: string }>;
  orderAddress: ShippingAddress;
  reasons: Array<{ value: string; label: string; photoRequired: boolean }>;
  maxPhotos: number;
}

interface TransitionOptions {
  note?: string;
  refundReference?: string;
  pickupScheduledFor?: Date;
  rejectionReason?: string;
  now?: Date;
}

const subOrderForReturn = {
  order: {
    select: {
      id: true,
      orderNumber: true,
      userId: true,
      paymentMethod: true,
      paymentStatus: true,
      shippingAddress: true,
    },
  },
  vendor: { select: { slug: true, displayName: true } },
  items: { orderBy: { productName: 'asc' } },
} satisfies Prisma.SubOrderInclude;

@Injectable()
export class ReturnsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: FileStorage,
    private readonly addresses: AddressesService,
    private readonly wallet: WalletService,
    private readonly events: EventEmitter2,
  ) {}

  async eligibility(
    userId: string,
    subOrderId: string,
    now = new Date(),
  ): Promise<ReturnEligibility> {
    const subOrder = await this.prisma.subOrder.findFirst({
      where: { id: subOrderId, order: { userId } },
      include: subOrderForReturn,
    });
    if (!subOrder) throw new NotFoundException('Order not found');

    const returned = await this.returnedQuantities(this.prisma, subOrder.id);
    const items = subOrder.items.map((item) => ({
      orderItemId: item.id,
      name: item.productName,
      image: item.imageUrl,
      brand: item.brand,
      orderedQuantity: item.quantity,
      returnableQuantity: Math.max(0, item.quantity - (returned.get(item.id) ?? 0)),
      unitPricePaise: item.unitPricePaise,
    }));

    let reason: string | null = null;
    if (!RETURNABLE_SUB_ORDER_STATUSES.includes(subOrder.status)) {
      reason =
        subOrder.status === SubOrderStatus.RETURNED
          ? 'All items from this shipment have already been returned.'
          : 'Items can be returned after they are delivered.';
    } else if (!subOrder.returnWindowEndsAt || subOrder.returnWindowEndsAt < now) {
      reason = 'The return window for this shipment has closed.';
    } else if (items.every((item) => item.returnableQuantity === 0)) {
      reason = 'A return is already open for every item in this shipment.';
    }

    return {
      subOrderId: subOrder.id,
      subOrderNumber: subOrder.subOrderNumber,
      order: { id: subOrder.order.id, orderNumber: subOrder.order.orderNumber },
      seller: { slug: subOrder.vendor.slug, name: subOrder.vendor.displayName },
      eligible: reason === null,
      reason,
      returnEligibleUntil: subOrder.returnWindowEndsAt,
      items,
      refundMethods: refundMethodsFor(subOrder.order.paymentMethod).map((method) => ({
        method,
        destination: refundDestinationFor(method, subOrder.order.paymentMethod),
      })),
      orderAddress: toShippingAddress(subOrder.order.shippingAddress),
      reasons: Object.entries(RETURN_REASON_LABELS).map(([value, label]) => ({
        value,
        label,
        photoRequired: PHOTO_REQUIRED_REASONS.includes(
          value as (typeof PHOTO_REQUIRED_REASONS)[number],
        ),
      })),
      maxPhotos: MAX_RETURN_PHOTOS,
    };
  }

  async create(userId: string, dto: CreateReturnDto): Promise<ReturnDetail> {
    const now = new Date();
    const eligibility = await this.eligibility(userId, dto.subOrderId, now);
    if (!eligibility.eligible) throw new ConflictException(eligibility.reason);

    if (!eligibility.refundMethods.some((option) => option.method === dto.refundMethod)) {
      throw new BadRequestException({
        message: 'Choose one of the refund options shown for this order',
        field: 'refundMethod',
      });
    }
    if (PHOTO_REQUIRED_REASONS.includes(dto.reason) && dto.photoIds.length === 0) {
      throw new BadRequestException({
        message: 'Add at least one photo that shows the problem',
        field: 'photoIds',
      });
    }

    const available = new Map(eligibility.items.map((item) => [item.orderItemId, item]));
    const seen = new Set<string>();
    let refundAmountPaise = 0;
    for (const item of dto.items) {
      const line = available.get(item.orderItemId);
      if (!line || seen.has(item.orderItemId)) {
        throw new BadRequestException({
          message: 'Choose items from this shipment',
          field: 'items',
        });
      }
      seen.add(item.orderItemId);
      if (item.quantity > line.returnableQuantity) {
        throw new BadRequestException({
          message: `You can return up to ${line.returnableQuantity} of ${line.name}`,
          field: 'items',
        });
      }
      refundAmountPaise += line.unitPricePaise * item.quantity;
    }

    const pickupAddress = dto.pickupAddressId
      ? toAddressSnapshot(await this.addresses.findOwned(userId, dto.pickupAddressId))
      : eligibility.orderAddress;

    const created = await this.prisma.$transaction(async (tx) => {
      // Re-check inside the transaction so two quick submissions cannot over-return.
      const returned = await this.returnedQuantities(tx, dto.subOrderId);
      for (const item of dto.items) {
        const line = available.get(item.orderItemId)!;
        if (item.quantity > line.orderedQuantity - (returned.get(item.orderItemId) ?? 0)) {
          throw new ConflictException(
            'These items already have a return. Please refresh the page.',
          );
        }
      }

      let row: { id: string } | null = null;
      for (let attempt = 0; attempt < 5 && !row; attempt++) {
        const number = returnNumber(now);
        const clash = await tx.returnRequest.findUnique({ where: { returnNumber: number } });
        if (clash) continue;
        row = await tx.returnRequest.create({
          data: {
            returnNumber: number,
            userId,
            subOrderId: dto.subOrderId,
            reason: dto.reason,
            comments: dto.comments ?? null,
            pickupAddress: { ...pickupAddress } as Prisma.InputJsonObject,
            refundMethod: dto.refundMethod,
            refundAmountPaise,
            requestedAt: now,
            items: {
              create: dto.items.map((item) => ({
                orderItemId: item.orderItemId,
                quantity: item.quantity,
                unitPricePaise: available.get(item.orderItemId)!.unitPricePaise,
              })),
            },
            events: {
              create: {
                status: ReturnStatus.REQUESTED,
                title: RETURN_EVENT_TITLES.REQUESTED,
                occurredAt: now,
              },
            },
          },
          select: { id: true },
        });
      }
      if (!row) throw new ConflictException('Please try again.');

      if (dto.photoIds.length) {
        const attached = await tx.returnPhoto.updateMany({
          where: { id: { in: dto.photoIds }, userId, returnId: null },
          data: { returnId: row.id },
        });
        if (attached.count !== dto.photoIds.length) {
          throw new BadRequestException({
            message: 'One of the photos could not be found. Upload it again.',
            field: 'photoIds',
          });
        }
      }

      await this.syncSubOrder(tx, dto.subOrderId);
      return row;
    });

    this.events.emit(RETURN_REQUESTED_EVENT, {
      userId,
      returnId: created.id,
      subOrderId: dto.subOrderId,
    });
    return this.detail(userId, created.id);
  }

  async list(userId: string, query: ReturnListQueryDto): Promise<Page<ReturnSummary>> {
    const where = { userId };
    const [rows, total] = await Promise.all([
      this.prisma.returnRequest.findMany({
        where,
        include: returnInclude,
        orderBy: [{ requestedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.returnRequest.count({ where }),
    ]);
    return toPage(rows.map(toReturnSummary), total, query.page, query.pageSize);
  }

  async detail(userId: string, id: string): Promise<ReturnDetail> {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id, userId },
      include: returnInclude,
    });
    if (!row) throw new NotFoundException('Return not found');
    return toReturnDetail(row);
  }

  async cancel(userId: string, id: string): Promise<ReturnDetail> {
    const row = await this.prisma.returnRequest.findFirst({
      where: { id, userId },
      select: { status: true },
    });
    if (!row) throw new NotFoundException('Return not found');
    if (!CUSTOMER_CANCELLABLE.includes(row.status)) {
      throw new ConflictException(
        'This return can no longer be cancelled because the item has been picked up.',
      );
    }
    await this.transition(id, ReturnStatus.CANCELLED);
    return this.detail(userId, id);
  }

  async uploadPhoto(userId: string, file: UploadedImage | undefined): Promise<{ id: string }> {
    if (!file?.buffer?.length)
      throw new BadRequestException({ message: 'Choose a photo to upload', field: 'photo' });
    if (file.size > MAX_PHOTO_BYTES) {
      throw new BadRequestException({ message: 'Photos must be 5 MB or smaller', field: 'photo' });
    }
    const type = detectImageType(file.buffer);
    if (!type)
      throw new BadRequestException({ message: 'Upload a JPG, PNG or WebP photo', field: 'photo' });

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await this.prisma.returnPhoto.count({
      where: { userId, returnId: null, createdAt: { gte: since } },
    });
    if (recent >= MAX_DAILY_UPLOADS) {
      throw new ConflictException(
        'Too many photos uploaded today. Submit your return or try again tomorrow.',
      );
    }

    const id = randomUUID();
    const storageKey = `returns/${userId}/${id}.${type.extension}`;
    await this.storage.put(storageKey, file.buffer);
    await this.prisma.returnPhoto.create({
      data: { id, userId, storageKey, contentType: type.contentType, sizeBytes: file.size },
    });
    return { id };
  }

  /** Only the customer who uploaded a photo can see it. */
  async photo(userId: string, photoId: string): Promise<{ content: Buffer; contentType: string }> {
    const photo = await this.prisma.returnPhoto.findFirst({ where: { id: photoId, userId } });
    if (!photo) throw new NotFoundException('Photo not found');
    return { content: await this.storage.read(photo.storageKey), contentType: photo.contentType };
  }

  /**
   * Moves a return to its next state. Used by the customer (cancel), Operations (6.3)
   * and the development seed. Issues the refund when the return reaches REFUNDED.
   */
  async transition(id: string, to: ReturnStatus, options: TransitionOptions = {}): Promise<void> {
    const now = options.now ?? new Date();
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.returnRequest.findUnique({
        where: { id },
        include: { subOrder: { include: { order: true } } },
      });
      if (!row) throw new NotFoundException('Return not found');
      if (!RETURN_TRANSITIONS[row.status].includes(to)) {
        throw new ConflictException(
          `A ${row.status.toLowerCase()} return cannot move to ${to.toLowerCase()}`,
        );
      }

      const data: Prisma.ReturnRequestUpdateManyMutationInput = { status: to };
      if (to === ReturnStatus.APPROVED) {
        data.approvedAt = now;
        data.pickupScheduledFor =
          options.pickupScheduledFor ?? new Date(now.getTime() + 24 * 60 * 60 * 1000);
      }
      if (to === ReturnStatus.PICKED_UP) data.pickedUpAt = now;
      if (to === ReturnStatus.RECEIVED) data.receivedAt = now;
      if (to === ReturnStatus.REJECTED) {
        data.rejectedAt = now;
        data.rejectionReason = options.rejectionReason ?? null;
      }
      if (to === ReturnStatus.CANCELLED) data.cancelledAt = now;
      if (to === ReturnStatus.REFUNDED) data.refundedAt = now;

      const updated = await tx.returnRequest.updateMany({
        where: { id, status: row.status },
        data,
      });
      if (updated.count === 0)
        throw new ConflictException('This return was just updated. Please refresh the page.');

      if (to === ReturnStatus.REFUNDED) {
        let reference = options.refundReference ?? null;
        if (row.refundMethod === ReturnRefundMethod.WALLET) {
          const entry = await this.wallet.credit(tx, row.userId, {
            amountPaise: row.refundAmountPaise,
            source: WalletEntrySource.REFUND,
            description: `Refund for return ${row.returnNumber}`,
            reference: row.returnNumber,
          });
          reference = entry.id;
        }
        await tx.returnRequest.update({ where: { id }, data: { refundReference: reference } });

        const order = row.subOrder.order;
        if (
          order.paymentStatus === PaymentStatus.PAID ||
          order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED
        ) {
          await tx.order.update({
            where: { id: order.id },
            data: { paymentStatus: PaymentStatus.PARTIALLY_REFUNDED },
          });
        }
      }

      await tx.returnEvent.create({
        data: {
          returnId: id,
          status: to,
          title: RETURN_EVENT_TITLES[to],
          note:
            to === ReturnStatus.REJECTED
              ? (options.rejectionReason ?? options.note ?? null)
              : (options.note ?? null),
          occurredAt: now,
        },
      });
      await this.syncSubOrder(tx, row.subOrderId);
    });

    this.events.emit(RETURN_STATUS_CHANGED_EVENT, { returnId: id, status: to });
  }

  /** Quantity per order item already held by returns that are open or done. */
  private async returnedQuantities(
    db: Prisma.TransactionClient,
    subOrderId: string,
  ): Promise<Map<string, number>> {
    const rows = await db.returnItem.groupBy({
      by: ['orderItemId'],
      where: { returnRequest: { subOrderId, status: { in: OPEN_OR_DONE_STATUSES } } },
      _sum: { quantity: true },
    });
    return new Map(rows.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
  }

  /** Keeps the sub-order status in step with its returns, so order pages show the right chip. */
  private async syncSubOrder(tx: Prisma.TransactionClient, subOrderId: string): Promise<void> {
    const subOrder = await tx.subOrder.findUnique({
      where: { id: subOrderId },
      select: { status: true, items: { select: { id: true, quantity: true } } },
    });
    if (!subOrder) return;
    const managed: SubOrderStatus[] = [...RETURNABLE_SUB_ORDER_STATUSES, SubOrderStatus.RETURNED];
    if (!managed.includes(subOrder.status)) return;

    const open = await tx.returnRequest.count({
      where: { subOrderId, status: { in: OPEN_STATUSES } },
    });
    let next: SubOrderStatus = SubOrderStatus.DELIVERED;
    if (open > 0) {
      next = SubOrderStatus.RETURN_REQUESTED;
    } else {
      const refunded = await tx.returnItem.groupBy({
        by: ['orderItemId'],
        where: { returnRequest: { subOrderId, status: ReturnStatus.REFUNDED } },
        _sum: { quantity: true },
      });
      const byItem = new Map(refunded.map((row) => [row.orderItemId, row._sum.quantity ?? 0]));
      if (subOrder.items.every((item) => (byItem.get(item.id) ?? 0) >= item.quantity)) {
        next = SubOrderStatus.RETURNED;
      }
    }
    if (next !== subOrder.status) {
      await tx.subOrder.update({ where: { id: subOrderId }, data: { status: next } });
    }
  }
}
