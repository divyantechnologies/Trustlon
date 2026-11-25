import { randomInt } from 'crypto';
import {
  PaymentMethod,
  ReturnReason,
  ReturnRefundMethod,
  ReturnStatus,
  SubOrderStatus,
} from '@prisma/client';

/** Returns that still hold quantity: everything except rejected and cancelled ones. */
export const OPEN_OR_DONE_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.PICKED_UP,
  ReturnStatus.RECEIVED,
  ReturnStatus.REFUNDED,
];

/** Returns still in progress. */
export const OPEN_STATUSES: ReturnStatus[] = [
  ReturnStatus.REQUESTED,
  ReturnStatus.APPROVED,
  ReturnStatus.PICKED_UP,
  ReturnStatus.RECEIVED,
];

/** The customer can withdraw a return until the courier collects it. */
export const CUSTOMER_CANCELLABLE: ReturnStatus[] = [ReturnStatus.REQUESTED, ReturnStatus.APPROVED];

/** Sub-order states that allow a (further) return. */
export const RETURNABLE_SUB_ORDER_STATUSES: SubOrderStatus[] = [
  SubOrderStatus.DELIVERED,
  SubOrderStatus.RETURN_REQUESTED,
];

/** Reasons that need at least one photo, so the seller can verify the problem. */
export const PHOTO_REQUIRED_REASONS: ReturnReason[] = [
  ReturnReason.DAMAGED,
  ReturnReason.DEFECTIVE,
  ReturnReason.WRONG_ITEM,
];

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  DAMAGED: 'Item arrived damaged',
  DEFECTIVE: 'Item is defective or not working',
  WRONG_ITEM: 'Received the wrong item',
  NOT_AS_DESCRIBED: 'Item is not as described',
  SIZE_OR_FIT: 'Size or fit is not right',
  MISSING_PARTS: 'Parts or accessories are missing',
  NO_LONGER_NEEDED: 'No longer needed',
  OTHER: 'Other reason',
};

/** Allowed next states, used by Operations (6.3) and the development seed. */
export const RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  REQUESTED: [ReturnStatus.APPROVED, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
  APPROVED: [ReturnStatus.PICKED_UP, ReturnStatus.REJECTED, ReturnStatus.CANCELLED],
  PICKED_UP: [ReturnStatus.RECEIVED],
  RECEIVED: [ReturnStatus.REFUNDED, ReturnStatus.REJECTED],
  REFUNDED: [],
  REJECTED: [],
  CANCELLED: [],
};

export const RETURN_EVENT_TITLES: Record<ReturnStatus, string> = {
  REQUESTED: 'Return requested',
  APPROVED: 'Return approved, pickup scheduled',
  PICKED_UP: 'Picked up by the courier',
  RECEIVED: 'Received and checked by the seller',
  REFUNDED: 'Refund issued',
  REJECTED: 'Return rejected',
  CANCELLED: 'Return cancelled by you',
};

/**
 * Refund choices. Spec 3.3: refunds go to the original payment method; cash on delivery
 * has no card or UPI to refund to, so those refunds go to the Trustlon wallet.
 */
export function refundMethodsFor(paymentMethod: PaymentMethod): ReturnRefundMethod[] {
  if (paymentMethod === PaymentMethod.COD || paymentMethod === PaymentMethod.WALLET) {
    return [ReturnRefundMethod.WALLET];
  }
  return [ReturnRefundMethod.ORIGINAL_PAYMENT, ReturnRefundMethod.WALLET];
}

export function returnNumber(now: Date): string {
  const yy = String(now.getUTCFullYear()).slice(2);
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `RT${yy}${mm}${String(randomInt(0, 1_000_000)).padStart(6, '0')}`;
}
