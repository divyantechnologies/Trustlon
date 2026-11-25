'use client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { Button, Dialog, cn, focusRing, inputClass } from '@/design-system';
import { CategoryFilters } from '../category/CategoryFilters';
import { loadStores } from '../category/cache';
import { SORTS, type CategoryQuery } from '../category/query';
import { CategoryNav } from '../home/components/CategoryNav';
import { HomeFooter } from '../home/components/HomeFooter';
import { HomeHeader } from '../home/components/HomeHeader';
import { MarketplaceDialogs } from '../home/components/MarketplaceDialogs';
import { ProductCard } from '../home/components/ProductCard';
import { SectionError, SectionSkeleton } from '../home/components/SectionStates';
import { useHome } from '../home/home-provider';
import { formatPrice } from '../home/format';
import type { Store } from '../home/types';
import { NoResultsState } from './NoResultsState';
import { SearchResultHeader } from './SearchResultHeader';
import {
  parseSearch,
  searchApiQuery,
  searchHref,
  serializeSearch,
  type SearchQuery,
} from './query';
import { useSearchResults } from './use-search-results';

const GRID = 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4';

export function SearchPage() {
  const router = useRouter();
  const raw = useSearchParams().toString();
  const canonical = serializeSearch(parseSearch(new URLSearchParams(raw)));
  const query = useMemo(() => parseSearch(new URLSearchParams(canonical)), [canonical]);
  const result = useSearchResults(searchApiQuery(query));
  const { home, homeState, reloadHome } = useHome();
  const categories = home?.categories.flatMap((category) => [category, ...category.children]) ?? [];
  const [stores, setStores] = useState<Store[]>([]);
  const [storeError, setStoreError] = useState(false);
  const [storeAttempt, setStoreAttempt] = useState(0);
  const [mobile, setMobile] = useState(false);
  const [pending, startTransition] = useTransition();
  const data = result.data;

  useEffect(() => {
    if (raw !== canonical) router.replace(searchHref(query), { scroll: false });
  }, [raw, canonical, router, query]);
  useEffect(() => {
    let cancelled = false;
    setStoreError(false);
    void loadStores()
      .then((value) => {
        if (!cancelled) setStores(value.items);
      })
      .catch(() => {
        if (!cancelled) setStoreError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeAttempt]);
  useEffect(() => {
    if (data && query.page > data.totalPages) {
      router.replace(searchHref({ ...query, page: data.totalPages }), { scroll: false });
    }
  }, [data, query, router]);

  function navigate(next: SearchQuery) {
    if (serializeSearch(next) === canonical) return;
    startTransition(() => router.push(searchHref(next), { scroll: false }));
  }
  function apply(next: CategoryQuery) {
    setMobile(false);
    navigate({ ...next, q: query.q, autocorrect: query.autocorrect, page: 1 });
  }
  const clear = () => apply({ sort: query.sort, page: 1 });
  const active: Array<{
    key: 'category' | 'store' | 'minPricePaise' | 'maxPricePaise' | 'inStock';
    label: string;
  }> = [
    ...(query.category
      ? [
          {
            key: 'category' as const,
            label: categories.find((c) => c.slug === query.category)?.name ?? query.category,
          },
        ]
      : []),
    ...(query.store
      ? [
          {
            key: 'store' as const,
            label: stores.find((s) => s.slug === query.store)?.name ?? query.store,
          },
        ]
      : []),
    ...(query.minPricePaise !== undefined
      ? [
          {
            key: 'minPricePaise' as const,
            label: `Min: ${formatPrice(query.minPricePaise, { showPaise: true })}`,
          },
        ]
      : []),
    ...(query.maxPricePaise !== undefined
      ? [
          {
            key: 'maxPricePaise' as const,
            label: `Max: ${formatPrice(query.maxPricePaise, { showPaise: true })}`,
          },
        ]
      : []),
    ...(query.inStock ? [{ key: 'inStock' as const, label: 'In stock' }] : []),
  ];
  const filters = { query, stores, categories, availability: true, onApply: apply };

  return (
    <>
      <HomeHeader searchQuery={query.q} />
      <CategoryNav />
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="Breadcrumb" className="mb-5 flex gap-2 text-sm text-slate-500">
          <Link href="/" className={cn('rounded text-teal-600 hover:underline', focusRing)}>
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Search</span>
        </nav>
        <SearchResultHeader
          query={query}
          data={data}
          loading={result.status === 'loading' || pending}
        />
        <div className="mt-8 flex items-start gap-6">
          <aside
            aria-label="Product filters"
            className="hidden w-56 shrink-0 space-y-5 rounded-lg border border-slate-200 bg-white p-4 lg:block"
          >
            <h2 className="text-lg font-semibold">Filters ({active.length})</h2>
            <CategoryFilters {...filters} />
          </aside>
          <div className="min-w-0 flex-1">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="lg:hidden">
                <Button variant="secondary" onClick={() => setMobile(true)}>
                  Filters ({active.length})
                </Button>
              </div>
              <label className="ml-auto flex items-center gap-2 text-sm">
                <span className="shrink-0">Sort by</span>
                <select
                  className={inputClass(false)}
                  value={query.sort}
                  onChange={(event) => {
                    const sort =
                      SORTS.find((item) => item.value === event.target.value)?.value ?? 'relevance';
                    apply({ ...query, sort });
                  }}
                >
                  {SORTS.map((sort) => (
                    <option key={sort.value} value={sort.value}>
                      {sort.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {(storeError || homeState === 'error') && (
              <div className="mb-5 space-y-2 text-sm text-slate-500">
                {storeError && (
                  <p>
                    Store choices are unavailable.{' '}
                    <Button variant="link" onClick={() => setStoreAttempt((n) => n + 1)}>
                      Retry stores
                    </Button>
                  </p>
                )}
                {homeState === 'error' && (
                  <p>
                    Category choices are unavailable.{' '}
                    <Button variant="link" onClick={reloadHome}>
                      Retry categories
                    </Button>
                  </p>
                )}
              </div>
            )}
            {active.length > 0 && (
              <div aria-label="Active filters" className="mb-5 flex flex-wrap items-center gap-3">
                {active.map((item) => (
                  <Button
                    key={item.key}
                    variant="link"
                    className="min-h-11 border border-slate-300 px-3"
                    aria-label={`Remove ${item.label}`}
                    onClick={() => apply({ ...query, [item.key]: undefined })}
                  >
                    {item.label} <span aria-hidden="true">×</span>
                  </Button>
                ))}
                <Button variant="link" onClick={clear}>
                  Clear all filters
                </Button>
              </div>
            )}
            <div aria-busy={result.status === 'loading' || pending}>
              {result.status === 'loading' && (
                <SectionSkeleton cards={8} title={false} gridClassName={GRID} />
              )}
              {result.status === 'error' && (
                <SectionError
                  message="We couldn’t load your search results. Please try again."
                  onRetry={result.retry}
                />
              )}
              {result.status === 'ready' &&
                data &&
                (data.items.length ? (
                  <div className={cn('grid auto-rows-fr gap-4', GRID)}>
                    {data.items.map((product) => (
                      <ProductCard key={product.id} product={product} showUnrated />
                    ))}
                  </div>
                ) : (
                  <NoResultsState
                    query={data.search?.query ?? query.q}
                    filtered={active.length > 0}
                    onClear={clear}
                  />
                ))}
            </div>
            {data && data.totalPages > 1 && (
              <nav
                aria-label="Search result pages"
                className="mt-8 flex flex-wrap items-center justify-center gap-4"
              >
                <Button
                  variant="secondary"
                  disabled={pending || query.page <= 1}
                  onClick={() => navigate({ ...query, page: query.page - 1 })}
                >
                  Previous
                </Button>
                <span aria-live="polite" className="text-sm text-slate-500">
                  Page {data.page.toLocaleString('en-IN')} of{' '}
                  {data.totalPages.toLocaleString('en-IN')}
                </span>
                <Button
                  variant="secondary"
                  disabled={pending || query.page >= data.totalPages}
                  onClick={() => navigate({ ...query, page: query.page + 1 })}
                >
                  Next
                </Button>
              </nav>
            )}
          </div>
        </div>
        <Dialog
          open={mobile}
          title={`Filters (${active.length})`}
          variant="drawer"
          onClose={() => setMobile(false)}
        >
          {mobile && <CategoryFilters {...filters} mobile />}
        </Dialog>
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
