import type { ProductQuery, ProductSort } from '../home/types';

export const SORTS: ReadonlyArray<{ value: ProductSort; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Rating' },
];

export interface CategoryQuery {
  sort: ProductSort;
  page: number;
  minPricePaise?: number;
  maxPricePaise?: number;
  store?: string;
  /** Optional search facets; category routes retain their existing URL contract. */
  category?: string;
  inStock?: boolean;
}

function integer(value: string | null, minimum: number): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum ? number : undefined;
}

export function parseQuery(params: URLSearchParams): CategoryQuery {
  const sort = SORTS.find((item) => item.value === params.get('sort'))?.value ?? 'relevance';
  const minPricePaise = integer(params.get('minPricePaise'), 0);
  let maxPricePaise = integer(params.get('maxPricePaise'), 0);
  // Retain the valid lower bound when a shared URL contains an inverted range.
  if (minPricePaise !== undefined && maxPricePaise !== undefined && minPricePaise > maxPricePaise) {
    maxPricePaise = undefined;
  }
  const store = params.get('store')?.trim();
  return {
    sort,
    page: integer(params.get('page'), 1) ?? 1,
    minPricePaise,
    maxPricePaise,
    store: store && store.length <= 80 && /^[a-zA-Z0-9_-]+$/.test(store) ? store : undefined,
  };
}

export function serializeQuery(query: CategoryQuery): string {
  const params = new URLSearchParams();
  if (query.sort !== 'relevance') params.set('sort', query.sort);
  if (query.minPricePaise !== undefined) params.set('minPricePaise', String(query.minPricePaise));
  if (query.maxPricePaise !== undefined) params.set('maxPricePaise', String(query.maxPricePaise));
  if (query.store) params.set('store', query.store);
  if (query.page > 1) params.set('page', String(query.page));
  return params.toString();
}

export function productQuery(slug: string, query: CategoryQuery): ProductQuery {
  return {
    category: slug,
    sort: query.sort,
    store: query.store,
    minPricePaise: query.minPricePaise,
    maxPricePaise: query.maxPricePaise,
    pageSize: 24,
  };
}

/** Inputs display rupees; the API accepts integer paise. Never round invalid input. */
export function priceToPaise(value: string): number | undefined {
  if (!value.trim()) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(value.trim())) return NaN;
  const [rupees, paise = ''] = value.trim().split('.');
  const result = Number(rupees) * 100 + Number(paise.padEnd(2, '0'));
  return Number.isSafeInteger(result) ? result : NaN;
}
