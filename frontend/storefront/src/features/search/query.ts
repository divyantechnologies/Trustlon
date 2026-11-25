import { parseQuery, serializeQuery, type CategoryQuery } from '../category/query';
import type { ProductQuery } from '../home/types';

export interface SearchQuery extends CategoryQuery {
  q: string;
  autocorrect: boolean;
}

export function normalizeSearch(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 100);
}

export function parseSearch(params: URLSearchParams): SearchQuery {
  const category = params.get('category')?.trim();
  return {
    ...parseQuery(params),
    q: normalizeSearch(params.get('q') ?? ''),
    autocorrect: params.get('autocorrect') !== 'false',
    category:
      category && category.length <= 80 && /^[a-zA-Z0-9_-]+$/.test(category) ? category : undefined,
    inStock: ['true', '1'].includes(params.get('inStock') ?? '') || undefined,
  };
}

export function serializeSearch(query: SearchQuery): string {
  const params = new URLSearchParams();
  if (query.q) params.set('q', query.q);
  if (!query.autocorrect) params.set('autocorrect', 'false');
  if (query.category) params.set('category', query.category);
  if (query.inStock) params.set('inStock', 'true');
  new URLSearchParams(serializeQuery(query)).forEach((value, key) => params.set(key, value));
  return params.toString();
}

export function searchHref(query: SearchQuery): string {
  const params = serializeSearch(query);
  return `/search${params ? `?${params}` : ''}`;
}

export function searchApiQuery(query: SearchQuery): ProductQuery {
  return { ...query, pageSize: 24 };
}

export function recentSearches(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, string>();
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const query = normalizeSearch(item);
    if (query && !unique.has(query.toLowerCase())) unique.set(query.toLowerCase(), query);
  }
  return [...unique.values()].slice(0, 6);
}
