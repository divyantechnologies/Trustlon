import { Prisma, ReturnReason, ReturnRefundMethod, ReturnStatus } from '@prisma/client';
import {
  PAYMENT_METHOD_LABELS,
  ShippingAddress,
  toShippingAddress,
} from '../orders/order.presenter';
import { CUSTOMER_CANCELLABLE, RETURN_REASON_LABELS } from './return-rules';

export const returnInclude = {
  subOrder: {
    select: {
      id: true,
      subOrderNumber: true,
      vendor: { select: { slug: true, displayName: true } },
      order: { select: { id: true, orderNumber: true, paymentMethod: true } },
    },
  },
  items: {
    include: {
      orderItem: { select: { productName: true, productSlug: true, imageUrl: true, brand: true } },
    },
  },
  photos: { select: { id: true }, orderBy: { createdAt: 'asc' } },
  events: { orderBy: { occurredAt: 'asc' } },
} satisfies Prisma.ReturnRequestInclude;

export type ReturnRow = Prisma.ReturnRequestGetPayload<{ include: typeof returnInclude }>;

export interface ReturnSummary {
  id: string;
  returnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonLabel: string;
  requestedAt: Date;
  refundAmountPaise: number;
  order: { id: string; orderNumber: string };
  subOrderNumber: string;
  seller: { slug: string; name: string };
  items: Array<{ name: string; image: string; quantity: number }>;
}

export interface ReturnDetail extends Omit<ReturnSummary, 'items'> {
  comments: string | null;
  pickupAddress: ShippingAddress;
  pickupScheduledFor: Date | null;
  rejectionReason: string | null;
  refund: {
    method: ReturnRefundMethod;
    destination: string;
    amountPaise: number;
    reference: string | null;
    refundedAt: Date | null;
  };
  items: Array<{
    orderItemId: string;
    name: string;
    slug: string;
    brand: string | null;
    image: string;
    quantity: number;
    unitPricePaise: number;
  }>;
  photos: Array<{ id: string }>;
  events: Array<{ status: ReturnStatus; title: string; note: string | null; occurredAt: Date }>;
  canCancel: boolean;
}

export function refundDestinationFor(
  method: ReturnRefundMethod,
  paymentMethod: keyof typeof PAYMENT_METHOD_LABELS,
): string {
  return method === ReturnRefundMethod.WALLET
    ? 'your Trustlon wallet'
    : `your original payment method (${PAYMENT_METHOD_LABELS[paymentMethod]})`;
}

export function toReturnSummary(row: ReturnRow): ReturnSummary {
  return {
    id: row.id,
    returnNumber: row.returnNumber,
    status: row.status,
    reason: row.reason,
    reasonLabel: RETURN_REASON_LABELS[row.reason],
    requestedAt: row.requestedAt,
    refundAmountPaise: row.refundAmountPaise,
    order: { id: row.subOrder.order.id, orderNumber: row.subOrder.order.orderNumber },
    subOrderNumber: row.subOrder.subOrderNumber,
    seller: { slug: row.subOrder.vendor.slug, name: row.subOrder.vendor.displayName },
    items: row.items.map((item) => ({
      name: item.orderItem.productName,
      image: item.orderItem.imageUrl,
      quantity: item.quantity,
    })),
  };
}

export function toReturnDetail(row: ReturnRow): ReturnDetail {
  return {
    ...toReturnSummary(row),
    comments: row.comments,
    pickupAddress: toShippingAddress(row.pickupAddress),
    pickupScheduledFor: row.pickupScheduledFor,
    rejectionReason: row.rejectionReason,
    refund: {
      method: row.refundMethod,
      destination: refundDestinationFor(row.refundMethod, row.subOrder.order.paymentMethod),
      amountPaise: row.refundAmountPaise,
      reference: row.refundReference,
      refundedAt: row.refundedAt,
    },
    items: row.items.map((item) => ({
      orderItemId: item.orderItemId,
      name: item.orderItem.productName,
      slug: item.orderItem.productSlug,
      brand: item.orderItem.brand,
      image: item.orderItem.imageUrl,
      quantity: item.quantity,
      unitPricePaise: item.unitPricePaise,
    })),
    photos: row.photos.map((photo) => ({ id: photo.id })),
    events: row.events.map((event) => ({
      status: event.status,
      title: event.title,
      note: event.note,
      occurredAt: event.occurredAt,
    })),
    canCancel: CUSTOMER_CANCELLABLE.includes(row.status),
  };
}
