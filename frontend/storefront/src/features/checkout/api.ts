import { apiFetch } from '@/lib/http';
import type { CheckoutInput, CheckoutQuote, CreateOrderInput, CreatedOrder, GatewayOrder, PaymentVerification } from './types';
export const checkoutApi = {
  validate: (body: CheckoutInput, signal?: AbortSignal) => apiFetch<CheckoutQuote>('/checkout/validate', { method: 'POST', auth: true, body, signal }),
  create: (body: CreateOrderInput) => apiFetch<CreatedOrder>('/orders', { method: 'POST', auth: true, body }),
  gateway: (orderId: string) => apiFetch<GatewayOrder>('/payments/razorpay/order', { method: 'POST', auth: true, body: { orderId } }),
  verify: (body: PaymentVerification) => apiFetch<{ confirmed: boolean; orderId: string; message?: string }>('/payments/razorpay/verify', { method: 'POST', auth: true, body }),
};
