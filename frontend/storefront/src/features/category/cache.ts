import { homeApi } from '../home/api';
import type { CategoryDetail, Page, Product, ProductQuery, Store } from '../home/types';

// Public catalog data only. Failed requests are evicted so retry always reaches the API.
// In-flight entries are shared across Strict Mode effects and route remounts.
const TTL = 5 * 60 * 1000;
const MAX_ENTRIES = 120;
interface Entry<T> {
  promise: Promise<T>;
  expires: number;
}
const pages = new Map<string, Entry<Page<Product>>>();
const categories = new Map<string, Entry<CategoryDetail>>();
const stores = new Map<string, Entry<{ items: Store[] }>>();

function read<T>(cache: Map<string, Entry<T>>, key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = cache.get(key);
  if (existing && existing.expires > Date.now()) return existing.promise;
  const entry: Entry<T> = { promise: Promise.resolve().then(fetcher), expires: Infinity };
  cache.delete(key);
  cache.set(key, entry);
  entry.promise = entry.promise.then(
    (value) => {
      entry.expires = Date.now() + TTL;
      // Evict settled entries only; never break request deduplication.
      for (const [oldKey, oldEntry] of cache) {
        if (cache.size <= MAX_ENTRIES) break;
        if (oldEntry.expires !== Infinity) cache.delete(oldKey);
      }
      return value;
    },
    (error: unknown) => {
      if (cache.get(key) === entry) cache.delete(key);
      throw error;
    },
  );
  return entry.promise;
}

export const loadCategory = (slug: string) => read(categories, slug, () => homeApi.category(slug));
export const loadStores = () => read(stores, 'verified', () => homeApi.verifiedStores());
export const loadProducts = (query: ProductQuery, page: number) =>
  read(pages, JSON.stringify({ ...query, page }), () => homeApi.products({ ...query, page }));

export function uniqueProducts(pages: ReadonlyArray<Page<Product>>): Product[] {
  const products = new Map<string, Product>();
  for (const page of pages)
    for (const product of page.items) {
      if (!products.has(product.id)) products.set(product.id, product);
    }
  return [...products.values()];
}
