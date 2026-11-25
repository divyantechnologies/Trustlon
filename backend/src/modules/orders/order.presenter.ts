import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RefundStatus,
  ReturnStatus,
  SubOrderStatus,
} from '@prisma/client';
import { isCancellable, OrderStage, orderStage, returnEligibleUntil } from './order-rules';

export const orderSummaryInclude = {
  subOrders: {
    orderBy: { subOrderNumber: 'asc' },
    select: {
      id: true,
      subOrderNumber: true,
      status: true,
      expectedDeliveryAt: true,
      deliveredAt: true,
      vendor: { select: { slug: true, displayName: true } },
      items: { select: { productName: true, imageUrl: true, quantity: true } },
    },
  },
} satisfies Prisma.OrderInclude;

export const orderDetailInclude = {
  subOrders: {
    orderBy: { subOrderNumber: 'asc' },
    include: {
      vendor: { select: { slug: true, displayName: true, isVerified: true } },
      items: { orderBy: { productName: 'asc' } },
      events: { orderBy: { occurredAt: 'asc' } },
      returns: {
        orderBy: { requestedAt: 'desc' },
        select: { id: true, returnNumber: true, status: true },
      },
    },
  },
} satisfies Prisma.OrderInclude;

export type OrderSummaryRow = Prisma.OrderGetPayload<{ include: typeof orderSummaryInclude }>;
export type OrderDetailRow = Prisma.OrderGetPayload<{ include: typeof orderDetailInclude }>;

export interface ShippingAddress {
  name: string;
  mobile: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  placedAt: Date;
  stage: OrderStage;
  totalPaise: number;
  itemCount: number;
  /** Up to four items for the order card thumbnails. */
  previewItems: Array<{ name: string; image: string }>;
  subOrders: Array<{
    id: string;
    subOrderNumber: string;
    status: SubOrderStatus;
    seller: { slug: string; name: string };
    expectedDeliveryAt: Date | null;
    deliveredAt: Date | null;
  }>;
}

export interface OrderItemView {
  id: string;
  productId: string | null;
  slug: string;
  name: string;
  brand: string | null;
  image: string;
  quantity: number;
  unitPricePaise: number;
  unitMrpPaise: number;
  totalPaise: number;
}

export interface SubOrderView {
  id: string;
  subOrderNumber: string;
  status: SubOrderStatus;
  seller: { slug: string; name: string; isVerified: boolean };
  items: OrderItemView[];
  totals: {
    itemsTotalPaise: number;
    couponDiscountPaise: number;
    deliveryPaise: number;
    taxPaise: number;
    totalPaise: number;
  };
  shipment: {
    courierName: string | null;
    awb: string | null;
    expectedDeliveryAt: Date | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    events: Array<{
      status: SubOrderStatus;
      title: string;
      location: string | null;
      occurredAt: Date;
    }>;
  };
  cancellation: { cancelledAt: Date; reason: string | null; by: string | null } | null;
  refund: {
    status: RefundStatus;
    amountPaise: number;
    destination: string;
    reference: string | null;
    refundedAt: Date | null;
  } | null;
  invoice: { number: string; issuedAt: Date | null } | null;
  /** Returns raised for this shipment, newest first. */
  returns: Array<{ id: string; returnNumber: string; status: ReturnStatus }>;
  actions: {
    canCancel: boolean;
    /** Last day to request a return; null when the item cannot be returned now. */
    returnEligibleUntil: Date | null;
  };
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  placedAt: Date;
  stage: OrderStage;
  payment: { method: PaymentMethod; status: PaymentStatus; reference: string | null };
  shippingAddress: ShippingAddress;
  breakup: {
    mrpTotalPaise: number;
    /** MRP minus selling price across all items. */
    productDiscountPaise: number;
    couponCode: string | null;
    couponDiscountPaise: number;
    deliveryPaise: number;
    taxPaise: number;
    totalPaise: number;
    refundedPaise: number;
    refundStatus: RefundStatus;
  };
  subOrders: SubOrderView[];
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  CARD: 'Credit or debit card',
  NETBANKING: 'Net banking',
  WALLET: 'Trustlon wallet',
  COD: 'Cash on delivery',
};

const text = (value: unknown): string => (typeof value === 'string' ? value : '');
const optionalText = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

export function toShippingAddress(value: Prisma.JsonValue): ShippingAddress {
  const raw: Record<string, unknown> =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    name: text(raw.name),
    mobile: text(raw.mobile),
    line1: text(raw.line1),
    line2: optionalText(raw.line2),
    landmark: optionalText(raw.landmark),
    city: text(raw.city),
    state: text(raw.state),
    pincode: text(raw.pincode),
  };
}

export function toOrderSummary(order: OrderSummaryRow): OrderSummary {
  const items = order.subOrders.flatMap((sub) => sub.items);
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    stage: orderStage(order.subOrders.map((sub) => sub.status)),
    totalPaise: order.totalPaise,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    previewItems: items
      .slice(0, 4)
      .map((item) => ({ name: item.productName, image: item.imageUrl })),
    subOrders: order.subOrders.map((sub) => ({
      id: sub.id,
      subOrderNumber: sub.subOrderNumber,
      status: sub.status,
      seller: { slug: sub.vendor.slug, name: sub.vendor.displayName },
      expectedDeliveryAt: sub.expectedDeliveryAt,
      deliveredAt: sub.deliveredAt,
    })),
  };
}

/** Reads naturally after "to", e.g. "refunded to your Trustlon wallet". */
function refundDestination(method: PaymentMethod): string {
  if (method === PaymentMethod.WALLET) return 'your Trustlon wallet';
  return `your original payment method (${PAYMENT_METHOD_LABELS[method]})`;
}

export function toOrderDetail(order: OrderDetailRow, now = new Date()): OrderDetail {
  const subOrders: SubOrderView[] = order.subOrders.map((sub) => ({
    id: sub.id,
    subOrderNumber: sub.subOrderNumber,
    status: sub.status,
    seller: {
      slug: sub.vendor.slug,
      name: sub.vendor.displayName,
      isVerified: sub.vendor.isVerified,
    },
    items: sub.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      slug: item.productSlug,
      name: item.productName,
      brand: item.brand,
      image: item.imageUrl,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
      unitMrpPaise: item.unitMrpPaise,
      totalPaise: item.unitPricePaise * item.quantity,
    })),
    totals: {
      itemsTotalPaise: sub.itemsTotalPaise,
      couponDiscountPaise: sub.couponDiscountPaise,
      deliveryPaise: sub.deliveryPaise,
      taxPaise: sub.taxPaise,
      totalPaise: sub.totalPaise,
    },
    shipment: {
      courierName: sub.courierName,
      awb: sub.awb,
      expectedDeliveryAt: sub.expectedDeliveryAt,
      shippedAt: sub.shippedAt,
      deliveredAt: sub.deliveredAt,
      events: sub.events.map((event) => ({
        status: event.status,
        title: event.title,
        location: event.location,
        occurredAt: event.occurredAt,
      })),
    },
    cancellation: sub.cancelledAt
      ? { cancelledAt: sub.cancelledAt, reason: sub.cancelReason, by: sub.cancelledBy }
      : null,
    refund:
      sub.refundStatus === RefundStatus.NONE
        ? null
        : {
            status: sub.refundStatus,
            amountPaise: sub.refundPaise,
            destination: refundDestination(order.paymentMethod),
            reference: sub.refundReference,
            refundedAt: sub.refundedAt,
          },
    invoice: sub.invoiceNumber ? { number: sub.invoiceNumber, issuedAt: sub.invoicedAt } : null,
    returns: sub.returns.map((r) => ({ id: r.id, returnNumber: r.returnNumber, status: r.status })),
    actions: {
      canCancel: isCancellable(sub.status),
      returnEligibleUntil: returnEligibleUntil(sub.status, sub.returnWindowEndsAt, now),
    },
  }));

  const refunds = order.subOrders.filter((sub) => sub.refundStatus !== RefundStatus.NONE);
  const refundStatus = refunds.some((sub) => sub.refundStatus === RefundStatus.PENDING)
    ? RefundStatus.PENDING
    : refunds.length
      ? RefundStatus.PROCESSED
      : RefundStatus.NONE;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    placedAt: order.placedAt,
    stage: orderStage(order.subOrders.map((sub) => sub.status)),
    payment: {
      method: order.paymentMethod,
      status: order.paymentStatus,
      reference: order.paymentReference,
    },
    shippingAddress: toShippingAddress(order.shippingAddress),
    breakup: {
      mrpTotalPaise: order.mrpTotalPaise,
      productDiscountPaise: Math.max(0, order.mrpTotalPaise - order.itemsTotalPaise),
      couponCode: order.couponCode,
      couponDiscountPaise: order.couponDiscountPaise,
      deliveryPaise: order.deliveryPaise,
      taxPaise: order.taxPaise,
      totalPaise: order.totalPaise,
      refundedPaise: refunds.reduce((sum, sub) => sum + sub.refundPaise, 0),
      refundStatus,
    },
    subOrders,
  };
}
