import type { AddressLabel, PaymentMethod, ReturnStatus, SubOrderStatus } from './types';

const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const rupeesExact = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money from the API is in paise. Whole rupees unless the amount has paise. */
export const formatMoney = (paise: number) =>
  paise % 100 === 0 ? rupees.format(paise / 100) : rupeesExact.format(paise / 100);

const shortDate = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const weekdayDate = new Intl.DateTimeFormat('en-IN', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});
const dateTime = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** 12 Nov 2026 */
export const formatDate = (iso: string) => shortDate.format(new Date(iso));
/** Thu, 12 Nov */
export const formatDay = (iso: string) => weekdayDate.format(new Date(iso));
/** 12 Nov, 4:30 pm */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

export const STATUS_LABELS: Record<SubOrderStatus, string> = {
  PLACED: 'Order placed',
  CONFIRMED: 'Confirmed',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  RETURN_REQUESTED: 'Return requested',
  RETURNED: 'Returned',
};

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  UPI: 'UPI',
  CARD: 'Credit or debit card',
  NETBANKING: 'Net banking',
  WALLET: 'Trustlon wallet',
  COD: 'Cash on delivery',
};

/** One line under a sub-order: when it arrives, arrived or what happened to it. */
export function deliveryNote(sub: {
  status: SubOrderStatus;
  expectedDeliveryAt: string | null;
  deliveredAt: string | null;
}): string {
  if (sub.status === 'DELIVERED' && sub.deliveredAt)
    return `Delivered on ${formatDay(sub.deliveredAt)}`;
  if (sub.status === 'CANCELLED') return 'Cancelled';
  if (sub.status === 'RETURN_REQUESTED') return 'Return in progress';
  if (sub.status === 'RETURNED') return 'Returned';
  if (sub.status === 'OUT_FOR_DELIVERY') return 'Arriving today';
  if (sub.expectedDeliveryAt) return `Arriving by ${formatDay(sub.expectedDeliveryAt)}`;
  return STATUS_LABELS[sub.status];
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return (
    ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() ||
    '?'
  );
}

export const RETURN_STATUS_LABELS: Record<ReturnStatus, string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Pickup scheduled',
  PICKED_UP: 'Picked up',
  RECEIVED: 'Received by seller',
  REFUNDED: 'Refunded',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
};

export const ADDRESS_LABELS: Record<AddressLabel, string> = {
  HOME: 'Home',
  WORK: 'Work',
  OTHER: 'Other',
};

/** States and union territories of India, matching the API's list. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

/** Rupees typed by the customer (e.g. "1,299.50") to paise, or null when it is not a valid amount. */
export function rupeesToPaise(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}
