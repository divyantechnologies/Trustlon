import { PaymentMethod, PaymentStatus, SubOrderStatus } from '@prisma/client';

/** A sub-order can be cancelled only until the seller hands it to the courier. */
export const CANCELLABLE_STATUSES: SubOrderStatus[] = [
  SubOrderStatus.PLACED,
  SubOrderStatus.CONFIRMED,
  SubOrderStatus.PACKED,
];

export const ORDER_STATUS_GROUPS = {
  active: [
    SubOrderStatus.PLACED,
    SubOrderStatus.CONFIRMED,
    SubOrderStatus.PACKED,
    SubOrderStatus.SHIPPED,
    SubOrderStatus.OUT_FOR_DELIVERY,
  ],
  delivered: [SubOrderStatus.DELIVERED],
  cancelled: [SubOrderStatus.CANCELLED],
  returns: [SubOrderStatus.RETURN_REQUESTED, SubOrderStatus.RETURNED],
} as const satisfies Record<string, readonly SubOrderStatus[]>;

export type OrderStatusGroup = keyof typeof ORDER_STATUS_GROUPS;
export const ORDER_STATUS_GROUP_KEYS = Object.keys(ORDER_STATUS_GROUPS) as OrderStatusGroup[];

/** Overall state of an order, worked out from its sub-orders. */
export type OrderStage = 'in_progress' | 'delivered' | 'cancelled' | 'returns';

export function orderStage(statuses: SubOrderStatus[]): OrderStage {
  const has = (group: OrderStatusGroup) => {
    const members: readonly SubOrderStatus[] = ORDER_STATUS_GROUPS[group];
    return statuses.some((status) => members.includes(status));
  };
  if (has('active')) return 'in_progress';
  if (has('returns')) return 'returns';
  if (has('delivered')) return 'delivered';
  return 'cancelled';
}

export function isCancellable(status: SubOrderStatus): boolean {
  return CANCELLABLE_STATUSES.includes(status);
}

/** Last day a delivered sub-order can be returned, or null when it is not returnable now. */
export function returnEligibleUntil(
  status: SubOrderStatus,
  returnWindowEndsAt: Date | null,
  now = new Date(),
): Date | null {
  const returnable =
    status === SubOrderStatus.DELIVERED || status === SubOrderStatus.RETURN_REQUESTED;
  if (!returnable || !returnWindowEndsAt) return null;
  return returnWindowEndsAt.getTime() >= now.getTime() ? returnWindowEndsAt : null;
}

/** Where a cancelled sub-order's money goes. Nothing is refunded if nothing was paid. */
export type RefundPlan =
  | { kind: 'none' }
  | { kind: 'wallet'; amountPaise: number }
  | { kind: 'original_method'; amountPaise: number };

export function planCancellationRefund(
  order: { paymentMethod: PaymentMethod; paymentStatus: PaymentStatus },
  amountPaise: number,
): RefundPlan {
  const paid =
    order.paymentStatus === PaymentStatus.PAID ||
    order.paymentStatus === PaymentStatus.PARTIALLY_REFUNDED;
  if (!paid || amountPaise <= 0) return { kind: 'none' };
  if (order.paymentMethod === PaymentMethod.WALLET) return { kind: 'wallet', amountPaise };
  return { kind: 'original_method', amountPaise };
}

export const CANCEL_REASONS = {
  ORDERED_BY_MISTAKE: 'Ordered by mistake',
  FOUND_BETTER_PRICE: 'Found a better price',
  DELIVERY_TOO_LATE: 'Delivery date is too late',
  CHANGED_MIND: 'Changed my mind',
  WRONG_ADDRESS: 'Wrong delivery address',
  OTHER: 'Other reason',
} as const;

export type CancelReason = keyof typeof CANCEL_REASONS;

/** Number shown to customers, e.g. TL2611000101. */
export function formatOrderNumber(placedAt: Date, sequence: number): string {
  const yy = String(placedAt.getUTCFullYear()).slice(2);
  const mm = String(placedAt.getUTCMonth() + 1).padStart(2, '0');
  return `TL${yy}${mm}${String(sequence).padStart(6, '0')}`;
}
