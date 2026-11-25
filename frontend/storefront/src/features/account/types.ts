import type { Product } from '@/features/home/types';
import type { ApiLanguage } from '@/lib/i18n/languages';

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
  /** ISO 3166-1 alpha-2, e.g. IN. */
  country: string;
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
  country: string;
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

/* Wallet (3.6) */

export type WalletEntrySource = 'REFUND' | 'CASHBACK' | 'REFERRAL' | 'ORDER_PAYMENT' | 'ADJUSTMENT';
export type WalletFilter = 'refund' | 'cashback' | 'referral' | 'spend' | 'other';

export interface WalletOverview {
  balancePaise: number;
  coins: number;
  coinsExpiringSoon: { coins: number; withinDays: number; nextExpiry: string | null };
  totals: { creditedPaise: number; spentPaise: number };
  rules: {
    coinValuePaise: number;
    maxRedeemPercent: number;
    earnPerHundredRupees: number;
    expiryMonths: number;
  };
}

export interface WalletTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  source: WalletEntrySource;
  amountPaise: number;
  coins: number;
  balanceAfterPaise: number;
  description: string;
  reference: string | null;
  coinsExpireAt: string | null;
  createdAt: string;
}

/* Reviews (3.7) */

export type ReviewStatus = 'PUBLISHED' | 'UNDER_MODERATION' | 'REJECTED';

export interface PendingReview {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  deliveredAt: string | null;
  product: { id: string; slug: string; name: string; image: string; brand: string | null };
}

export interface MyReview {
  id: string;
  status: ReviewStatus;
  rating: number;
  title: string;
  body: string;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  orderItemId: string;
  orderNumber: string;
  product: { id: string; slug: string; name: string; image: string };
  media: Array<{ id: string; kind: 'PHOTO' | 'VIDEO' }>;
}

export interface ReviewInput {
  rating: number;
  title: string;
  body: string;
  mediaIds: string[];
}

/* B2B (3.8) */

export type BusinessStatus = 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface BusinessProfile {
  status: BusinessStatus;
  businessName: string;
  gstin: string;
  pan: string;
  billing: { line1: string; line2: string | null; city: string; state: string; pincode: string };
  rejectionReason: string | null;
  submittedAt: string;
  verifiedAt: string | null;
  bulkPricingEnabled: boolean;
}

export interface BusinessProfileInput {
  businessName: string;
  gstin: string;
  pan: string;
  billingLine1: string;
  billingLine2?: string;
  billingCity: string;
  billingState: string;
  billingPincode: string;
}

export interface GstinCheck {
  gstin: string;
  valid: boolean;
  reason: string | null;
  stateCode: string | null;
  state: string | null;
  pan: string | null;
}

/* Affiliate (3.9) */

export interface AffiliateSummary {
  referral: { code: string; path: string; friendsJoined: number; rewardsPaise: number };
  affiliate: {
    links: number;
    clicks: number;
    orders: number;
    pendingPaise: number;
    confirmedPaise: number;
    paidPaise: number;
  };
  rules: { commissionPercent: number; attributionDays: number; referralRewardPaise: number };
}

export interface AffiliateLink {
  id: string;
  code: string;
  path: string;
  clicks: number;
  createdAt: string;
  product: { id: string; slug: string; name: string; image: string; pricePaise: number } | null;
}

export interface AffiliateEarning {
  id: string;
  orderNumber: string;
  productName: string;
  saleAmountPaise: number;
  commissionPaise: number;
  status: 'PENDING' | 'CONFIRMED' | 'PAID' | 'CANCELLED';
  confirmAfter: string;
  createdAt: string;
}

/* Support (3.10) */

export type TicketCategory =
  | 'ORDER'
  | 'DELIVERY'
  | 'RETURN_REFUND'
  | 'PAYMENT'
  | 'PRODUCT'
  | 'ACCOUNT'
  | 'OTHER';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'AWAITING_CUSTOMER' | 'RESOLVED' | 'CLOSED';

export interface TicketSummary {
  id: string;
  ticketNumber: string;
  subject: string;
  category: TicketCategory;
  categoryLabel: string;
  status: TicketStatus;
  order: { id: string; orderNumber: string } | null;
  lastMessageAt: string;
  createdAt: string;
  lastMessage: { authorType: 'CUSTOMER' | 'AGENT' | 'SYSTEM'; preview: string } | null;
}

export interface TicketDetail extends TicketSummary {
  canReply: boolean;
  canClose: boolean;
  resolvedAt: string | null;
  closedAt: string | null;
  messages: Array<{
    id: string;
    authorType: 'CUSTOMER' | 'AGENT' | 'SYSTEM';
    authorName: string;
    body: string;
    createdAt: string;
    attachments: Array<{ id: string; fileName: string; contentType: string; sizeBytes: number }>;
  }>;
}

/* Account settings (3.11) */

export type Gender = 'FEMALE' | 'MALE' | 'OTHER' | 'PREFER_NOT_TO_SAY';
export type NotificationChannel = 'sms' | 'email' | 'whatsapp' | 'push';
export type NotificationEvent =
  | 'orders'
  | 'delivery'
  | 'returns'
  | 'priceAlerts'
  | 'offers'
  | 'account';
export type NotificationChoices = Record<NotificationEvent, Record<NotificationChannel, boolean>>;

export interface SettingsProfile {
  fullName: string;
  email: string;
  mobile: string;
  emailVerified: boolean;
  mobileVerified: boolean;
  dateOfBirth: string | null;
  gender: Gender | null;
  preferredLanguage: ApiLanguage;
  hasPassword: boolean;
  passwordChangedAt: string | null;
  memberSince: string;
}

export interface SettingsOverview {
  profile: SettingsProfile;
  notifications: { channels: NotificationChoices; locked: NotificationEvent[] };
  deletion: {
    blockers: string[];
    walletBalancePaise: number;
    coins: number;
    retentionYears: number;
  };
}

export interface ProfileInput {
  fullName?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  preferredLanguage?: ApiLanguage;
}

export interface ActiveSession {
  id: string;
  browser: string;
  os: string;
  mobile: boolean;
  ip: string | null;
  signedInAt: string;
  lastActiveAt: string;
  current: boolean;
}
