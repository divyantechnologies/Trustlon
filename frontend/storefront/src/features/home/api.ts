import { apiFetch } from '@/lib/http';
import { getGuestToken } from './guest';
import type {
  Cart,
  CategoryDetail,
  HomeData,
  LocalSeller,
  Page,
  Product,
  ProductQuery,
  Serviceability,
  Store,
  StoreDetail,
  Suggestions,
} from './types';

/** Sends the access token when signed in, and the guest token, so the API knows whose cart it is. */
function shopper() {
  const token = getGuestToken();
  return { auth: true, headers: token ? { 'x-guest-token': token } : undefined };
}

function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const homeApi = {
  home: (signal?: AbortSignal) => apiFetch<HomeData>('/home', { signal }),

  products: (query: ProductQuery, signal?: AbortSignal) =>
    apiFetch<Page<Product>>(`/products${toQuery(query)}`, { signal }),

  category: (slug: string) =>
    apiFetch<CategoryDetail>(
      `/categories/${encodeURIComponent(slug)}`,
    ),

  store: (slug: string) => apiFetch<StoreDetail>(`/stores/${encodeURIComponent(slug)}`),

  verifiedStores: () => apiFetch<{ items: Store[] }>('/stores'),

  suggest: (q: string, signal?: AbortSignal) =>
    apiFetch<Suggestions>(`/search/suggest${toQuery({ q: q.trim() })}`, { signal }),

  localSellers: (pincode: string, radiusKm = 10, signal?: AbortSignal) =>
    apiFetch<{ pincode: string; radiusKm: number; serviceable: boolean; sellers: LocalSeller[] }>(
      `/local/sellers${toQuery({ pincode, radiusKm })}`,
      { signal },
    ),

  serviceability: (pincode: string) =>
    apiFetch<Serviceability>(`/pincode/${encodeURIComponent(pincode)}/serviceability`),

  recommendations: (limit = 10, signal?: AbortSignal) =>
    apiFetch<{ items: Product[] }>(`/recommendations${toQuery({ limit })}`, { ...shopper(), signal }),

  recentlyViewed: () => apiFetch<{ items: Product[] }>('/me/recently-viewed', shopper()),

  recordView: (productId: string) =>
    apiFetch<void>('/me/recently-viewed', { ...shopper(), method: 'POST', body: { productId } }),

  cart: () => apiFetch<Cart>('/cart', shopper()),

  addToCart: (productId: string, quantity = 1) =>
    apiFetch<Cart>('/cart/items', { ...shopper(), method: 'POST', body: { productId, quantity } }),

  setCartQuantity: (productId: string, quantity: number) =>
    apiFetch<Cart>(`/cart/items/${productId}`, { ...shopper(), method: 'PATCH', body: { quantity } }),

  removeFromCart: (productId: string) =>
    apiFetch<Cart>(`/cart/items/${productId}`, { ...shopper(), method: 'DELETE' }),

  wishlist: () => apiFetch<{ items: Product[] }>('/me/wishlist', { auth: true }),

  addToWishlist: (productId: string) =>
    apiFetch<{ productIds: string[] }>(`/me/wishlist/${productId}`, { auth: true, method: 'PUT' }),

  removeFromWishlist: (productId: string) =>
    apiFetch<{ productIds: string[] }>(`/me/wishlist/${productId}`, { auth: true, method: 'DELETE' }),
};
