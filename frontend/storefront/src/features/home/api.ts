import { apiFetch } from '@/lib/http';
import { getGuestToken } from './guest';
import type {
  Cart,
  CategoryDetail,
  HomeData,
  LocalSeller,
  Page,
  Product,
  ProductDetail,
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
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringOrNull(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isProduct(value: unknown): value is Product {
  if (!isRecord(value) || !isRecord(value.category) || !isRecord(value.seller)) return false;
  const { category, seller } = value;
  const numericFields = ['pricePaise', 'mrpPaise', 'discountPercent', 'rating', 'ratingCount'];
  return (
    typeof value.id === 'string' && typeof value.slug === 'string' &&
    typeof value.name === 'string' && typeof value.image === 'string' &&
    typeof value.currency === 'string' && numericFields.every((key) => typeof value[key] === 'number' && Number.isFinite(value[key])) &&
    typeof value.inStock === 'boolean' && typeof value.codAvailable === 'boolean' &&
    isStringOrNull(value.badge) &&
    typeof category.slug === 'string' && typeof category.name === 'string' && isStringOrNull(category.nameHi) &&
    typeof seller.slug === 'string' && typeof seller.name === 'string' &&
    typeof seller.isVerified === 'boolean' && typeof seller.isPlatformOwned === 'boolean' &&
    typeof seller.trustScore === 'number' && Number.isFinite(seller.trustScore) &&
    (value.deal === null || (isRecord(value.deal) && typeof value.deal.endsAt === 'string'))
  );
}

/** Parse the untrusted JSON envelope without allowing malformed recommendations into UI state. */
export function parseRecommendations(response: unknown): Product[] {
  if (!isRecord(response) || !Array.isArray(response.items)) {
    throw new Error('Recommendations API returned an invalid response');
  }
  const items = response.items.filter(isProduct);
  if (response.items.length > 0 && items.length === 0) {
    throw new Error('Recommendations API returned no valid products');
  }
  return items;
}

export const homeApi = {
  home: (signal?: AbortSignal) => apiFetch<HomeData>('/home', { signal }),

  products: (query: ProductQuery, signal?: AbortSignal) =>
    apiFetch<Page<Product>>(`/products${toQuery(query)}`, { signal }),

  product: (slug: string, signal?: AbortSignal) =>
    apiFetch<{ product: ProductDetail; similar: Product[] }>(`/products/${encodeURIComponent(slug)}`, { signal }),

  search: (query: ProductQuery, signal?: AbortSignal) =>
    apiFetch<Page<Product>>(`/search${toQuery(query)}`, { signal }),

  category: (slug: string) => apiFetch<CategoryDetail>(`/categories/${encodeURIComponent(slug)}`),

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

  recommendations: async (limit = 10, signal?: AbortSignal): Promise<{ items: Product[] }> => {
    const response = await apiFetch<unknown>(`/recommendations${toQuery({ limit })}`, {
      ...shopper(),
      signal,
    });
    return { items: parseRecommendations(response) };
  },

  recentlyViewed: () => apiFetch<{ items: Product[] }>('/me/recently-viewed', shopper()),

  recordView: (productId: string) =>
    apiFetch<void>('/me/recently-viewed', { ...shopper(), method: 'POST', body: { productId } }),

  cart: () => apiFetch<Cart>('/cart', shopper()),

  addToCart: (productId: string, quantity = 1) =>
    apiFetch<Cart>('/cart/items', { ...shopper(), method: 'POST', body: { productId, quantity } }),

  setCartQuantity: (productId: string, quantity: number) =>
    apiFetch<Cart>(`/cart/items/${productId}`, {
      ...shopper(),
      method: 'PATCH',
      body: { quantity },
    }),

  removeFromCart: (productId: string) =>
    apiFetch<Cart>(`/cart/items/${productId}`, { ...shopper(), method: 'DELETE' }),

  wishlist: () => apiFetch<{ items: Product[] }>('/me/wishlist', { auth: true }),

  addToWishlist: (productId: string) =>
    apiFetch<{ productIds: string[] }>(`/me/wishlist/${productId}`, { auth: true, method: 'PUT' }),

  removeFromWishlist: (productId: string) =>
    apiFetch<{ productIds: string[] }>(`/me/wishlist/${productId}`, {
      auth: true,
      method: 'DELETE',
    }),
};
