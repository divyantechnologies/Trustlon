import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
  SubOrderStatus,
  WalletEntrySource,
} from '@prisma/client';
import { skip } from '../../../middlewares/admin/admin-query';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { EXPORT_LIMIT, toCsv } from '../../../middlewares/admin/csv';
import { toPage } from '../../../utils/http/pagination';
import { PrismaService } from '../../../database/prisma.service';
import { CANCELLABLE_STATUSES, orderStage, planCancellationRefund } from '../../orders/order-rules';
import { SUB_ORDER_CANCELLED, SubOrderCancelledEvent } from '../../orders/orders.service';
import { SiteSettingsService } from '../../site/site-settings.service';
import { WalletService } from '../../users/wallet/wallet.service';
import { addDays, istDayStart } from '../shared';
import { AdminCancelDto, OrderListQuery, ReassignCourierDto, RefundDto } from './dto';

const IN_TRANSIT: SubOrderStatus[] = [
  SubOrderStatus.PLACED,
  SubOrderStatus.CONFIRMED,
  SubOrderStatus.PACKED,
  SubOrderStatus.SHIPPED,
  SubOrderStatus.OUT_FOR_DELIVERY,
];

const listInclude = {
  user: { select: { id: true, fullName: true, mobile: true } },
  subOrders: {
    select: { status: true, awb: true, vendor: { select: { id: true, displayName: true } } },
  },
} satisfies Prisma.OrderInclude;

/** Order oversight (5.5): find any order and act on it. Amounts are in paise. */
@Injectable()
export class AdminOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly wallet: WalletService,
    private readonly site: SiteSettingsService,
    private readonly events: EventEmitter2,
  ) {}

  async list(query: OrderListQuery) {
    const q = query.q?.trim();
    const mobileDigits = q?.replace(/\D/g, '') ?? '';
    const sub: Prisma.SubOrderWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.vendorId ? { vendorId: query.vendorId } : {}),
    };
    const where: Prisma.OrderWhereInput = {
      ...(query.paymentStatus ? { paymentStatus: query.paymentStatus } : {}),
      ...(query.paymentMethod ? { paymentMethod: query.paymentMethod } : {}),
      ...(query.customerId ? { userId: query.customerId } : {}),
      ...(Object.keys(sub).length ? { subOrders: { some: sub } } : {}),
      ...(query.from || query.to
        ? {
            placedAt: {
              ...(query.from ? { gte: istDayStart(query.from) } : {}),
              ...(query.to ? { lt: istDayStart(addDays(query.to, 1)) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { orderNumber: { contains: q.toUpperCase() } },
              { subOrders: { some: { subOrderNumber: { contains: q.toUpperCase() } } } },
              { subOrders: { some: { awb: { contains: q.toUpperCase() } } } },
              { subOrders: { some: { invoiceNumber: { contains: q.toUpperCase() } } } },
              {
                subOrders: {
                  some: { vendor: { displayName: { contains: q, mode: 'insensitive' } } },
                },
              },
              ...(mobileDigits.length >= 6
                ? [{ user: { mobile: { contains: mobileDigits.slice(-10) } } }]
                : []),
              { user: { email: { contains: q.toLowerCase() } } },
            ],
          }
        : {}),
    };
    const csv = query.format === 'csv';
    const [rows, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        orderBy: { placedAt: 'desc' },
        skip: csv ? 0 : skip(query),
        take: csv ? EXPORT_LIMIT : query.pageSize,
        include: listInclude,
      }),
      this.prisma.order.count({ where }),
    ]);
    const items = rows.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      customer: order.user,
      stage: orderStage(order.subOrders.map((s) => s.status)),
      statuses: [...new Set(order.subOrders.map((s) => s.status))],
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
      totalPaise: order.totalPaise,
      vendors: [...new Map(order.subOrders.map((s) => [s.vendor.id, s.vendor])).values()],
      subOrders: order.subOrders.length,
      placedAt: order.placedAt,
    }));
    if (csv) {
      return toCsv(
        [
          'Order',
          'Placed',
          'Customer',
          'Mobile',
          'Vendors',
          'Status',
          'Payment',
          'Payment status',
          'Total (Rs)',
        ],
        items.map((o) => [
          o.orderNumber,
          o.placedAt.toISOString(),
          o.customer.fullName,
          o.customer.mobile,
          o.vendors.map((v) => v.displayName).join('; '),
          o.statuses.join('; '),
          o.paymentMethod,
          o.paymentStatus,
          (o.totalPaise / 100).toFixed(2),
        ]),
      );
    }
    return toPage(items, total, query.page, query.pageSize);
  }

  async detail(id: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            mobile: true,
            email: true,
            status: true,
            codDisabled: true,
          },
        },
        notes: { orderBy: { createdAt: 'desc' } },
        supportTickets: {
          select: { id: true, ticketNumber: true, subject: true, status: true, createdAt: true },
        },
        subOrders: {
          orderBy: { createdAt: 'asc' },
          include: {
            vendor: { select: { id: true, displayName: true, slug: true } },
            items: true,
            events: { orderBy: { occurredAt: 'asc' } },
            returns: {
              select: {
                id: true,
                returnNumber: true,
                status: true,
                refundAmountPaise: true,
                requestedAt: true,
                reason: true,
              },
            },
          },
        },
      },
    });
    if (!order) throw new NotFoundException('Order not found');

    const timeline = [
      {
        at: order.placedAt,
        title: 'Order placed',
        detail: `${order.paymentMethod} · ${order.paymentStatus}`,
        kind: 'order',
      },
      ...order.subOrders.flatMap((sub) => [
        ...sub.events.map((e) => ({
          at: e.occurredAt,
          title: e.title,
          detail: [sub.subOrderNumber, e.location].filter(Boolean).join(' · '),
          kind: 'shipment',
        })),
        ...sub.returns.map((r) => ({
          at: r.requestedAt,
          title: `Return ${r.returnNumber} requested`,
          detail: r.status,
          kind: 'return',
        })),
        ...(sub.refundedAt
          ? [
              {
                at: sub.refundedAt,
                title: 'Refund processed',
                detail: `${sub.subOrderNumber} · ₹${(sub.refundPaise / 100).toFixed(2)}`,
                kind: 'refund',
              },
            ]
          : []),
      ]),
      ...order.notes.map((n) => ({
        at: n.createdAt,
        title: `Note by ${n.authorName}`,
        detail: n.body,
        kind: 'note',
      })),
    ].sort((a, b) => a.at.getTime() - b.at.getTime());

    return {
      id: order.id,
      orderNumber: order.orderNumber,
      placedAt: order.placedAt,
      customer: order.user,
      stage: orderStage(order.subOrders.map((s) => s.status)),
      payment: {
        method: order.paymentMethod,
        status: order.paymentStatus,
        reference: order.paymentReference,
        mrpTotalPaise: order.mrpTotalPaise,
        itemsTotalPaise: order.itemsTotalPaise,
        couponCode: order.couponCode,
        couponDiscountPaise: order.couponDiscountPaise,
        deliveryPaise: order.deliveryPaise,
        taxPaise: order.taxPaise,
        totalPaise: order.totalPaise,
        refundedPaise: order.subOrders.reduce((sum, s) => sum + s.refundPaise, 0),
      },
      shippingAddress: order.shippingAddress,
      subOrders: order.subOrders.map((sub) => ({
        id: sub.id,
        subOrderNumber: sub.subOrderNumber,
        vendor: sub.vendor,
        status: sub.status,
        cancellable: CANCELLABLE_STATUSES.includes(sub.status),
        inTransit: IN_TRANSIT.includes(sub.status),
        totalPaise: sub.totalPaise,
        itemsTotalPaise: sub.itemsTotalPaise,
        deliveryPaise: sub.deliveryPaise,
        taxPaise: sub.taxPaise,
        courierName: sub.courierName,
        awb: sub.awb,
        expectedDeliveryAt: sub.expectedDeliveryAt,
        shippedAt: sub.shippedAt,
        deliveredAt: sub.deliveredAt,
        cancelledAt: sub.cancelledAt,
        cancelledBy: sub.cancelledBy,
        cancelReason: sub.cancelReason,
        invoiceNumber: sub.invoiceNumber,
        invoicedAt: sub.invoicedAt,
        refund: {
          status: sub.refundStatus,
          amountPaise: sub.refundPaise,
          reference: sub.refundReference,
          at: sub.refundedAt,
        },
        refundablePaise: Math.max(0, sub.totalPaise - sub.refundPaise),
        items: sub.items.map((item) => ({
          id: item.id,
          productId: item.productId,
          name: item.productName,
          slug: item.productSlug,
          imageUrl: item.imageUrl,
          quantity: item.quantity,
          unitPricePaise: item.unitPricePaise,
          gstRatePercent: item.gstRateBps / 100,
          hsnCode: item.hsnCode,
        })),
        returns: sub.returns,
      })),
      notes: order.notes.map((n) => ({
        id: n.id,
        body: n.body,
        by: n.authorName,
        at: n.createdAt,
      })),
      tickets: order.supportTickets,
      timeline,
    };
  }

  /** Cancels sub-orders that have not shipped. Paid amounts go back the same way as a customer cancellation. */
  async cancel(orderId: string, dto: AdminCancelDto, actor: Actor) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        subOrders: { include: { items: { select: { productId: true, quantity: true } } } },
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    const targets = order.subOrders.filter(
      (sub) =>
        (!dto.subOrderIds?.length || dto.subOrderIds.includes(sub.id)) &&
        CANCELLABLE_STATUSES.includes(sub.status),
    );
    if (targets.length === 0)
      throw new ConflictException(
        'Nothing in this order can be cancelled now (already shipped, delivered or cancelled)',
      );

    const now = new Date();
    const cancelled: SubOrderCancelledEvent[] = [];
    await this.prisma.$transaction(async (tx) => {
      for (const sub of targets) {
        const refund = planCancellationRefund(order, sub.totalPaise - sub.refundPaise);
        const updated = await tx.subOrder.updateMany({
          where: { id: sub.id, status: { in: CANCELLABLE_STATUSES } },
          data: {
            status: SubOrderStatus.CANCELLED,
            cancelledAt: now,
            cancelledBy: 'ADMIN',
            cancelReason: dto.reason,
            ...(refund.kind === 'wallet'
              ? {
                  refundStatus: RefundStatus.PROCESSED,
                  refundPaise: { increment: refund.amountPaise },
                  refundedAt: now,
                }
              : refund.kind === 'original_method'
                ? {
                    refundStatus: RefundStatus.PENDING,
                    refundPaise: { increment: refund.amountPaise },
                  }
                : {}),
          },
        });
        if (updated.count === 0)
          throw new ConflictException(
            'The order changed while you were working. Refresh and try again.',
          );
        await tx.shipmentEvent.create({
          data: {
            subOrderId: sub.id,
            status: SubOrderStatus.CANCELLED,
            title: 'Cancelled by Trustlon',
            occurredAt: now,
          },
        });
        for (const item of sub.items) {
          if (item.productId)
            await tx.product.updateMany({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
        }
        if (refund.kind === 'wallet') {
          await this.wallet.credit(tx, order.userId, {
            amountPaise: refund.amountPaise,
            source: WalletEntrySource.REFUND,
            description: `Refund for cancelled item in order ${order.orderNumber}`,
            reference: sub.subOrderNumber,
          });
        }
        cancelled.push({
          userId: order.userId,
          orderId,
          subOrderId: sub.id,
          vendorId: sub.vendorId,
          refundPaise: refund.kind === 'none' ? 0 : refund.amountPaise,
        });
      }
      await this.syncPaymentStatus(tx, orderId);
      await this.audit.log(
        actor,
        {
          action: 'order.cancel',
          entity: 'order',
          entityId: orderId,
          summary: order.orderNumber,
          reason: dto.reason,
          before: targets.map((s) => ({ subOrder: s.subOrderNumber, status: s.status })),
          after: { status: SubOrderStatus.CANCELLED },
        },
        tx,
      );
    });
    for (const event of cancelled) this.events.emit(SUB_ORDER_CANCELLED, event);
    return this.detail(orderId);
  }

  /** Refund to the wallet at once, or mark it for the payment gateway (processed by Operations/Finance). */
  async refund(orderId: string, dto: RefundDto, actor: Actor) {
    const sub = await this.prisma.subOrder.findFirst({
      where: { id: dto.subOrderId, orderId },
      include: {
        order: {
          select: { orderNumber: true, userId: true, paymentMethod: true, paymentStatus: true },
        },
      },
    });
    if (!sub) throw new NotFoundException('Sub-order not found');
    const paid =
      sub.order.paymentStatus !== PaymentStatus.PENDING &&
      sub.order.paymentStatus !== PaymentStatus.FAILED;
    if (!paid)
      throw new BadRequestException('This order was never paid, so there is nothing to refund');
    if (dto.method === 'ORIGINAL' && sub.order.paymentMethod === PaymentMethod.COD) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Cash on delivery orders are refunded to the wallet',
        field: 'method',
      });
    }
    const amountPaise = Math.round(dto.amountRupees * 100);
    const refundable = sub.totalPaise - sub.refundPaise;
    if (amountPaise > refundable) {
      throw new BadRequestException({
        statusCode: 400,
        message: `You can refund up to ₹${(refundable / 100).toFixed(2)}`,
        field: 'amountRupees',
      });
    }
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.subOrder.updateMany({
        where: { id: sub.id, refundPaise: sub.refundPaise },
        data: {
          refundPaise: { increment: amountPaise },
          refundStatus: dto.method === 'WALLET' ? RefundStatus.PROCESSED : RefundStatus.PENDING,
          ...(dto.method === 'WALLET' ? { refundedAt: now } : {}),
        },
      });
      if (updated.count === 0)
        throw new ConflictException('Another refund was just made. Refresh and try again.');
      if (dto.method === 'WALLET') {
        const entry = await this.wallet.credit(tx, sub.order.userId, {
          amountPaise,
          source: WalletEntrySource.REFUND,
          description: `Refund for order ${sub.order.orderNumber}`,
          reference: sub.subOrderNumber,
        });
        await tx.subOrder.update({ where: { id: sub.id }, data: { refundReference: entry.id } });
      }
      await this.syncPaymentStatus(tx, orderId);
      await this.audit.log(
        actor,
        {
          action: dto.method === 'WALLET' ? 'order.refund_wallet' : 'order.refund_initiated',
          entity: 'order',
          entityId: orderId,
          summary: `${sub.order.orderNumber} / ${sub.subOrderNumber}`,
          reason: dto.reason,
          before: { refundPaise: sub.refundPaise },
          after: { refundPaise: sub.refundPaise + amountPaise, method: dto.method },
        },
        tx,
      );
    });
    return this.detail(orderId);
  }

  async reassignCourier(orderId: string, dto: ReassignCourierDto, actor: Actor) {
    const sub = await this.prisma.subOrder.findFirst({
      where: { id: dto.subOrderId, orderId },
      include: { order: { select: { orderNumber: true } } },
    });
    if (!sub) throw new NotFoundException('Sub-order not found');
    if (!IN_TRANSIT.includes(sub.status))
      throw new ConflictException('The courier can only be changed before delivery');
    const courier = (await this.site.get('shipping')).couriers.find(
      (c) => c.code === dto.courierCode && c.enabled,
    );
    if (!courier)
      throw new BadRequestException({
        statusCode: 400,
        message: 'Choose an enabled courier partner',
        field: 'courierCode',
      });
    const clash = await this.prisma.subOrder.findUnique({
      where: { awb: dto.awb },
      select: { id: true },
    });
    if (clash && clash.id !== sub.id)
      throw new ConflictException({
        statusCode: 409,
        message: 'This AWB is already used by another shipment',
        field: 'awb',
      });
    await this.prisma.$transaction(async (tx) => {
      await tx.subOrder.update({
        where: { id: sub.id },
        data: { courierName: courier.name, awb: dto.awb },
      });
      await tx.shipmentEvent.create({
        data: {
          subOrderId: sub.id,
          status: sub.status,
          title: `Courier changed to ${courier.name}`,
          occurredAt: new Date(),
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'order.reassign_courier',
          entity: 'order',
          entityId: orderId,
          summary: `${sub.order.orderNumber} / ${sub.subOrderNumber}`,
          reason: dto.reason,
          before: { courier: sub.courierName, awb: sub.awb },
          after: { courier: courier.name, awb: dto.awb },
        },
        tx,
      );
    });
    return this.detail(orderId);
  }

  async addNote(orderId: string, body: string, actor: Actor, authorName: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { orderNumber: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    await this.prisma.$transaction(async (tx) => {
      await tx.orderNote.create({ data: { orderId, body, authorId: actor.id, authorName } });
      await this.audit.log(
        actor,
        {
          action: 'order.note',
          entity: 'order',
          entityId: orderId,
          summary: order.orderNumber,
          reason: body,
        },
        tx,
      );
    });
    return this.detail(orderId);
  }

  private async syncPaymentStatus(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.order.findUniqueOrThrow({
      where: { id: orderId },
      include: { subOrders: { select: { totalPaise: true, refundPaise: true } } },
    });
    if (
      order.paymentStatus === PaymentStatus.PENDING ||
      order.paymentStatus === PaymentStatus.FAILED
    )
      return;
    const refunded = order.subOrders.reduce((sum, s) => sum + s.refundPaise, 0);
    const total = order.subOrders.reduce((sum, s) => sum + s.totalPaise, 0);
    const status =
      refunded <= 0
        ? PaymentStatus.PAID
        : refunded >= total
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
    if (status !== order.paymentStatus)
      await tx.order.update({ where: { id: orderId }, data: { paymentStatus: status } });
  }
}
