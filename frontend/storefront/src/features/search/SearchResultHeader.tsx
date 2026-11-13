import Link from 'next/link';
import { cn, focusRing, typography } from '@/design-system';
import type { Page, Product } from '../home/types';
import { searchHref, type SearchQuery } from './query';

export function SearchResultHeader({
  query,
  data,
  loading,
}: {
  query: SearchQuery;
  data?: Page<Product>;
  loading: boolean;
}) {
  const effective = data?.search?.query ?? query.q;
  const first = data?.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.page * data.pageSize, data.total) : 0;
  return (
    <div className="min-w-0 space-y-3 break-words">
      <h1 className={typography.pageTitle}>
        {effective ? `Showing results for “${effective}”` : 'Explore products'}
      </h1>
      <p role="status" className={typography.secondary}>
        {loading
          ? 'Searching products…'
          : data
            ? `${data.total.toLocaleString('en-IN')} ${data.total === 1 ? 'product' : 'products'} found${data.total ? ` · Showing ${first.toLocaleString('en-IN')}–${last.toLocaleString('en-IN')}` : ''}`
            : 'Results unavailable'}
      </p>
      {data?.search?.corrected && (
        <p className="text-sm text-slate-500">
          We corrected your search.{' '}
          <Link
            className={cn(
              'inline-flex min-h-11 items-center rounded-lg text-teal-600 underline',
              focusRing,
            )}
            href={searchHref({ ...query, autocorrect: false, page: 1 })}
          >
            Search instead for “{query.q}”
          </Link>
        </p>
      )}
      {!query.q && (
        <p className={typography.secondary}>
          Search for a product, category or brand, or browse the catalog below.
        </p>
      )}
    </div>
  );
}
