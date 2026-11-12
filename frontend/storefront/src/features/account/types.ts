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
