import { apiFetch } from '@/lib/http';
import { getGuestToken } from '../home/guest';
import type { CartView, CartChanges } from './types';
const shopper = () => ({ auth: true, headers: { 'x-guest-token': getGuestToken() ?? '' } });
export const cartApi = {
  get: (signal?: AbortSignal) => apiFetch<CartView>('/cart', { ...shopper(), signal }),
  change: (id: string, body: CartChanges) => apiFetch<CartView>(`/cart/items/${encodeURIComponent(id)}`, { ...shopper(), method: 'PATCH', body }),
  remove: (id: string) => apiFetch<CartView>(`/cart/items/${encodeURIComponent(id)}`, { ...shopper(), method: 'DELETE' }),
  coupon: (code: string | null) => apiFetch<CartView>('/cart/coupon', { ...shopper(), method: code ? 'POST' : 'DELETE', body: code ? { code } : undefined }),
};
