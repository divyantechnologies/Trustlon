import type { CartView, PriceSummaryView } from './cart';
export type DeliveryMethod = 'standard' | 'express' | 'same-day';
export type CheckoutPayment = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'EMI' | 'COD' | 'TRUSTLON_WALLET';
export interface CheckoutInput {
  addressId?: string; gstin?: string;
  deliveries?: { vendorId: string; method: DeliveryMethod }[];
  paymentMethod?: CheckoutPayment;
}
export interface TaxBreakup { taxable: number; cgst: number; sgst: number; igst: number; total: number }
export interface CheckoutQuote {
  cart: CartView; summary: PriceSummaryView; tax: TaxBreakup;
  deliveryGroups: { vendorId: string; vendorName: string; selected: DeliveryMethod; options: { method: DeliveryMethod; fee: number; estimate: string }[] }[];
  paymentMethods: CheckoutPayment[]; walletBalance: number; isB2B: boolean;
  fingerprint: string; shippingState: string | null;
}
export interface CreateOrderInput extends CheckoutInput { checkoutKey: string; fingerprint: string }
export interface CreatedOrder { id: string; orderNumber: string; totalPaise: number; reservationExpiresAt: string | null; status: string }
export interface GatewayOrder { keyId: string; orderId: string; amount: number; currency: 'INR' }
export interface PaymentVerification { orderId: string; razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
