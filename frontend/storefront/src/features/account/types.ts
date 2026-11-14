import type { Product } from '@/features/home/types';

/** Response shapes of the account and order APIs. Money is in paise; dates are ISO strings. */

export type SubOrderStatus =
  | 'PLACED'
  | 'CONFIRMED'
  | 'PACKED'
  | 'SHIPPED'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'RETURN_REQUESTED'
  | 'RETURNED';

export type OrderStage = 'in_progress' | 'delivered' | 'cancelled' | 'returns';
export type OrderStatusFilter = 'active' | 'delivered' | 'cancelled' | 'returns';
export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'COD';
export type PaymentStatus = 'PENDING' | 'PAID' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
export type RefundStatus = 'NONE' | 'PENDING' | 'PROCESSED';

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface OrderSummary {
  id: string;
  orderNumber: string;
  placedAt: string;
  stage: OrderStage;
  totalPaise: number;
  itemCount: number;
  previewItems: Array<{ name: string; image: string }>;
  subOrders: Array<{
    id: string;
    subOrderNumber: string;
    status: SubOrderStatus;
    seller: { slug: string; name: string };
    expectedDeliveryAt: string | null;
    deliveredAt: string | null;
  }>;
}

export interface ShipmentEvent {
  status: SubOrderStatus;
  title: string;
  location: string | null;
  occurredAt: string;
}

export interface OrderItem {
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

export interface SubOrder {
  id: string;
  subOrderNumber: string;
  status: SubOrderStatus;
  seller: { slug: string; name: string; isVerified: boolean };
  items: OrderItem[];
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
    expectedDeliveryAt: string | null;
    shippedAt: string | null;
    deliveredAt: string | null;
    events: ShipmentEvent[];
  };
  cancellation: { cancelledAt: string; reason: string | null; by: string | null } | null;
  refund: {
    status: RefundStatus;
    amountPaise: number;
    destination: string;
    reference: string | null;
    refundedAt: string | null;
  } | null;
  invoice: { number: string; issuedAt: string | null } | null;
  returns: Array<{ id: string; returnNumber: string; status: ReturnStatus }>;
  actions: { canCancel: boolean; returnEligibleUntil: string | null };
}

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

export interface OrderDetail {
  id: string;
  orderNumber: string;
  placedAt: string;
  stage: OrderStage;
  payment: { method: PaymentMethod; status: PaymentStatus; reference: string | null };
  shippingAddress: ShippingAddress;
  breakup: {
    mrpTotalPaise: number;
    productDiscountPaise: number;
    couponCode: string | null;
    couponDiscountPaise: number;
    deliveryPaise: number;
    taxPaise: number;
    totalPaise: number;
    refundedPaise: number;
    refundStatus: RefundStatus;
  };
  subOrders: SubOrder[];
}

export interface AccountSummary {
  profile: {
    fullName: string;
    mobile: string;
    email: string;
    mobileVerified: boolean;
    emailVerified: boolean;
    memberSince: string;
  };
  prime: { active: boolean; plan: string | null; endsAt: string | null };
  wallet: { balancePaise: number; coins: number };
  recentOrders: OrderSummary[];
  counts: { orders: number; activeOrders: number; wishlist: number };
}

export interface OrderQuery {
  status?: OrderStatusFilter;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type CancelReason =
  | 'ORDERED_BY_MISTAKE'
  | 'FOUND_BETTER_PRICE'
  | 'DELIVERY_TOO_LATE'
  | 'CHANGED_MIND'
  | 'WRONG_ADDRESS'
  | 'OTHER';

/* Address book (3.5) */

export type AddressLabel = 'HOME' | 'WORK' | 'OTHER';

export interface Address {
  id: string;
  label: AddressLabel;
  labelName: string | null;
  fullName: string;
  mobile: string;
  line1: string;
  line2: string | null;
  landmark: string | null;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
  delivery: { serviceable: boolean; codAvailable: boolean; estimatedDeliveryDays: number | null };
}

export interface AddressInput {
  label: AddressLabel;
  labelName?: string;
  fullName: string;
  mobile: string;
  line1: string;
  line2?: string;
  landmark?: string;
  pincode: string;
  city: string;
  state: string;
  isDefault?: boolean;
}

/* Price alerts (3.4) */

export interface PriceAlert {
  id: string;
  status: 'ACTIVE' | 'PAUSED';
  targetPricePaise: number;
  priceAtCreationPaise: number;
  createdAt: string;
  product: Product | null;
  reached: boolean;
}

/* Returns (3.3) */

export type ReturnStatus =
  | 'REQUESTED'
  | 'APPROVED'
  | 'PICKED_UP'
  | 'RECEIVED'
  | 'REFUNDED'
  | 'REJECTED'
  | 'CANCELLED';

export type ReturnReason =
  | 'DAMAGED'
  | 'DEFECTIVE'
  | 'WRONG_ITEM'
  | 'NOT_AS_DESCRIBED'
  | 'SIZE_OR_FIT'
  | 'MISSING_PARTS'
  | 'NO_LONGER_NEEDED'
  | 'OTHER';

export type ReturnRefundMethod = 'ORIGINAL_PAYMENT' | 'WALLET';

export interface ReturnSummary {
  id: string;
  returnNumber: string;
  status: ReturnStatus;
  reason: ReturnReason;
  reasonLabel: string;
  requestedAt: string;
  refundAmountPaise: number;
  order: { id: string; orderNumber: string };
  subOrderNumber: string;
  seller: { slug: string; name: string };
  items: Array<{ name: string; image: string; quantity: number }>;
}

export interface ReturnDetail extends Omit<ReturnSummary, 'items'> {
  comments: string | null;
  pickupAddress: ShippingAddress;
  pickupScheduledFor: string | null;
  rejectionReason: string | null;
  refund: {
    method: ReturnRefundMethod;
    destination: string;
    amountPaise: number;
    reference: string | null;
    refundedAt: string | null;
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
  events: Array<{ status: ReturnStatus; title: string; note: string | null; occurredAt: string }>;
  canCancel: boolean;
}

export interface ReturnEligibility {
  subOrderId: string;
  subOrderNumber: string;
  order: { id: string; orderNumber: string };
  seller: { slug: string; name: string };
  eligible: boolean;
  reason: string | null;
  returnEligibleUntil: string | null;
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
  reasons: Array<{ value: ReturnReason; label: string; photoRequired: boolean }>;
  maxPhotos: number;
}

export interface CreateReturnInput {
  subOrderId: string;
  items: Array<{ orderItemId: string; quantity: number }>;
  reason: ReturnReason;
  comments?: string;
  photoIds: string[];
  pickupAddressId?: string;
  refundMethod: ReturnRefundMethod;
}
