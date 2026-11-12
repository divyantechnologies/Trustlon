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
  RefundStatus,
  SubOrderStatus,
  WalletEntrySource,
} from '@prisma/client';
import { Page, toPage } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { CancelSubOrderDto, OrderListQueryDto } from './dto';
import {
  CANCEL_REASONS,
  CANCELLABLE_STATUSES,
  ORDER_STATUS_GROUPS,
  planCancellationRefund,
} from './order-rules';
import {
  OrderDetail,
  orderDetailInclude,
  OrderSummary,
  orderSummaryInclude,
  toOrderDetail,
  toOrderSummary,
} from './order.presenter';

/** Emitted after a customer cancels part of an order; notifications and payouts listen for it. */
export const SUB_ORDER_CANCELLED = 'order.sub-order.cancelled';

export interface SubOrderCancelledEvent {
  userId: string;
  orderId: string;
  subOrderId: string;
  vendorId: string;
  refundPaise: number;
}

/** Dates in filters are calendar days in India Standard Time. */
const istStartOfDay = (date: string) => new Date(`${date}T00:00:00+05:30`);

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly events: EventEmitter2,
  ) {}

  async list(userId: string, query: OrderListQueryDto): Promise<Page<OrderSummary>> {
    const where = this.listWhere(userId, query);
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: orderSummaryInclude,
        orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return toPage(rows.map(toOrderSummary), total, query.page, query.pageSize);
  }

  /** Latest orders for the account overview. */
  async recent(userId: string, take = 3): Promise<OrderSummary[]> {
    const rows = await this.prisma.order.findMany({
      where: { userId },
      include: orderSummaryInclude,
      orderBy: [{ placedAt: 'desc' }, { id: 'desc' }],
      take,
    });
    return rows.map(toOrderSummary);
  }

  async detail(userId: string, orderId: string): Promise<OrderDetail> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, userId },
      include: orderDetailInclude,
    });
    // Another customer's order is reported as missing so order ids cannot be probed.
    if (!order) throw new NotFoundException('Order not found');
    return toOrderDetail(order);
  }

  async cancel(userId: string, subOrderId: string, dto: CancelSubOrderDto): Promise<OrderDetail> {
    const subOrder = await this.prisma.subOrder.findFirst({
      where: { id: subOrderId, order: { userId } },
      include: {
        order: {
          select: { id: true, orderNumber: true, paymentMethod: true, paymentStatus: true },
        },
        items: { select: { productId: true, quantity: true } },
      },
    });
    if (!subOrder) throw new NotFoundException('Order not found');
    if (subOrder.status === SubOrderStatus.CANCELLED) {
      throw new ConflictException('This item is already cancelled');
    }
    if (!CANCELLABLE_STATUSES.includes(subOrder.status)) {
      throw new ConflictException(
        'This item has already shipped, so it can no longer be cancelled. You can return it after delivery.',
      );
    }

    const now = new Date();
    const reason = dto.comment
      ? `${CANCEL_REASONS[dto.reason]}: ${dto.comment}`
      : CANCEL_REASONS[dto.reason];
    const refund = planCancellationRefund(subOrder.order, subOrder.totalPaise);

    await this.prisma.$transaction(async (tx) => {
      const refundData: Prisma.SubOrderUpdateManyMutationInput =
        refund.kind === 'none'
          ? {}
          : refund.kind === 'wallet'
            ? {
                refundStatus: RefundStatus.PROCESSED,
                refundPaise: refund.amountPaise,
                refundedAt: now,
              }
            : { refundStatus: RefundStatus.PENDING, refundPaise: refund.amountPaise };

      // Conditional update so a seller shipping at the same moment cannot be overridden.
      const updated = await tx.subOrder.updateMany({
        where: { id: subOrder.id, status: { in: CANCELLABLE_STATUSES } },
        data: {
          status: SubOrderStatus.CANCELLED,
          cancelledAt: now,
          cancelledBy: 'CUSTOMER',
          cancelReason: reason,
          ...refundData,
        },
      });
      if (updated.count === 0) {
        throw new ConflictException(
          'This item can no longer be cancelled. Please refresh the page.',
        );
      }

      await tx.shipmentEvent.create({
        data: {
          subOrderId: subOrder.id,
          status: SubOrderStatus.CANCELLED,
          title: 'Cancelled by you',
          occurredAt: now,
        },
      });

      for (const item of subOrder.items) {
        if (!item.productId) continue;
        await tx.product.updateMany({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
      }

      if (refund.kind === 'wallet') {
        const entry = await this.wallet.credit(tx, userId, {
          amountPaise: refund.amountPaise,
          source: WalletEntrySource.REFUND,
          description: `Refund for cancelled item in order ${subOrder.order.orderNumber}`,
          reference: subOrder.subOrderNumber,
        });
        await tx.subOrder.update({
          where: { id: subOrder.id },
          data: { refundReference: entry.id },
        });
      }

      if (refund.kind !== 'none') {
        const open = await tx.subOrder.count({
          where: { orderId: subOrder.orderId, status: { not: SubOrderStatus.CANCELLED } },
        });
        await tx.order.update({
          where: { id: subOrder.orderId },
          data: {
            paymentStatus: open === 0 ? PaymentStatus.REFUNDED : PaymentStatus.PARTIALLY_REFUNDED,
          },
        });
      }
    });

    const event: SubOrderCancelledEvent = {
      userId,
      orderId: subOrder.orderId,
      subOrderId: subOrder.id,
      vendorId: subOrder.vendorId,
      refundPaise: refund.kind === 'none' ? 0 : refund.amountPaise,
    };
    this.events.emit(SUB_ORDER_CANCELLED, event);

    return this.detail(userId, subOrder.orderId);
  }

  async tracking(userId: string, awb: string) {
    const subOrder = await this.prisma.subOrder.findFirst({
      where: { awb, order: { userId } },
      select: {
        awb: true,
        courierName: true,
        status: true,
        expectedDeliveryAt: true,
        shippedAt: true,
        deliveredAt: true,
        events: {
          orderBy: { occurredAt: 'asc' },
          select: { status: true, title: true, location: true, occurredAt: true },
        },
      },
    });
    if (!subOrder) throw new NotFoundException('Shipment not found');
    return subOrder;
  }

  async count(userId: string): Promise<{ total: number; active: number }> {
    const [total, active] = await Promise.all([
      this.prisma.order.count({ where: { userId } }),
      this.prisma.order.count({
        where: { userId, subOrders: { some: { status: { in: [...ORDER_STATUS_GROUPS.active] } } } },
      }),
    ]);
    return { total, active };
  }

  private listWhere(userId: string, query: OrderListQueryDto): Prisma.OrderWhereInput {
    const and: Prisma.OrderWhereInput[] = [{ userId }];

    if (query.status) {
      and.push({ subOrders: { some: { status: { in: [...ORDER_STATUS_GROUPS[query.status]] } } } });
    }
    if (query.q) {
      and.push({
        subOrders: {
          some: { items: { some: { productName: { contains: query.q, mode: 'insensitive' } } } },
        },
      });
    }

    const from = query.from ? istStartOfDay(query.from) : undefined;
    const toExclusive = query.to ? istStartOfDay(query.to) : undefined;
    if (toExclusive) toExclusive.setUTCDate(toExclusive.getUTCDate() + 1);
    if (
      (from && Number.isNaN(from.getTime())) ||
      (toExclusive && Number.isNaN(toExclusive.getTime()))
    ) {
      throw new BadRequestException('Enter a valid date');
    }
    if (from && toExclusive && from >= toExclusive) {
      throw new BadRequestException('The start date must be on or before the end date');
    }
    if (from || toExclusive) and.push({ placedAt: { gte: from, lt: toExclusive } });

    return { AND: and };
  }
}
