'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Button, Dialog, cn, focusRing, inputClass, typography } from '@/design-system';
import { ApiError } from '@/lib/http';
import { useI18n } from '@/lib/i18n/language-provider';
import { CategoryNav } from '../home/components/CategoryNav';
import { HomeFooter } from '../home/components/HomeFooter';
import { HomeHeader } from '../home/components/HomeHeader';
import { MarketplaceDialogs } from '../home/components/MarketplaceDialogs';
import { ProductCard } from '../home/components/ProductCard';
import { SectionError, SectionSkeleton } from '../home/components/SectionStates';
import { formatPrice } from '../home/format';
import type { CategoryDetail, Store } from '../home/types';
import { loadCategory, loadStores } from './cache';
import { CategoryBreadcrumb } from './CategoryBreadcrumb';
import { CategoryFilters } from './CategoryFilters';
import { parseQuery, productQuery, serializeQuery, SORTS, type CategoryQuery } from './query';
import { useCategoryProducts } from './use-category-products';

const GRID = 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
const scrollPositions = new Map<string, number>();

function CategoryListing({ category }: { category: CategoryDetail }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const canonical = serializeQuery(parseQuery(new URLSearchParams(search)));
  const query = useMemo(() => parseQuery(new URLSearchParams(canonical)), [canonical]);
  const filterKey = serializeQuery({ ...query, page: 1 });
  const apiQuery = useMemo(
    () => productQuery(category.slug, parseQuery(new URLSearchParams(filterKey))),
    [category.slug, filterKey],
  );
  const data = useCategoryProducts(apiQuery, query.page);
  const { language } = useI18n();
  const [mobile, setMobile] = useState(false);
  const [stores, setStores] = useState<Store[]>([]);
  const [storeError, setStoreError] = useState(false);
  const [storeAttempt, setStoreAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const replacing = useRef<string | null>(null);
  const navigation = useRef<'filters' | 'page' | null>(null);
  const restored = useRef<string | null>(null);
  const href = `${pathname}${canonical ? `?${canonical}` : ''}`;

  const replaceQuery = useCallback(
    (next: CategoryQuery, reason?: 'filters' | 'page') => {
      const nextSearch = serializeQuery(next);
      if (nextSearch === canonical || replacing.current === nextSearch) return;
      replacing.current = nextSearch;
      navigation.current = reason ?? null;
      startTransition(() =>
        router.replace(`${pathname}${nextSearch ? `?${nextSearch}` : ''}`, { scroll: false }),
      );
    },
    [canonical, pathname, router],
  );

  useEffect(() => {
    replacing.current = null;
  }, [canonical]);
  useEffect(() => {
    if (search !== canonical) router.replace(href, { scroll: false });
  }, [search, canonical, href, router]);

  useEffect(() => {
    let cancelled = false;
    setStoreError(false);
    void loadStores()
      .then((result) => {
        if (!cancelled) setStores(result.items);
      })
      .catch(() => {
        if (!cancelled) setStoreError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storeAttempt]);

  useEffect(() => {
    const remember = () => {
      if (restored.current !== href) return;
      scrollPositions.set(href, window.scrollY);
      if (scrollPositions.size > 50) {
        const oldest = scrollPositions.keys().next().value;
        if (oldest !== undefined) scrollPositions.delete(oldest);
      }
    };
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      window.removeEventListener('scroll', remember);
    };
  }, [href]);

  useEffect(() => {
    if (data.status !== 'ready' || data.totalPages === undefined) return;
    if (query.page > data.totalPages) {
      replaceQuery({ ...query, page: data.totalPages });
      return;
    }
    if (data.loadedPage < query.page || restored.current === href) return;
    const reason = navigation.current;
    const saved = scrollPositions.get(href);
    const frame = requestAnimationFrame(() => {
      restored.current = href;
      navigation.current = null;
      if (reason === 'filters') listRef.current?.scrollIntoView({ block: 'start' });
      else if (reason !== 'page' && saved !== undefined) window.scrollTo(0, saved);
      else if (reason !== 'page' && query.page > 1) {
        // A fresh shared link has no local scroll snapshot: show its last loaded page.
        const index = Math.min((query.page - 1) * 24, data.products.length - 1);
        listRef.current
          ?.querySelectorAll('[data-category-product]')
          [index]?.scrollIntoView({ block: 'start' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [
    href,
    query,
    data.status,
    data.totalPages,
    data.loadedPage,
    data.products.length,
    replaceQuery,
  ]);

  const canLoadMore =
    !pending &&
    data.status === 'ready' &&
    data.loadedPage === query.page &&
    query.page < (data.totalPages ?? 1);
  const loadMore = useCallback(() => {
    if (canLoadMore) replaceQuery({ ...query, page: query.page + 1 }, 'page');
  }, [canLoadMore, query, replaceQuery]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!canLoadMore || !sentinel || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [canLoadMore, loadMore]);

  const apply = (next: CategoryQuery) => {
    setMobile(false);
    replaceQuery({ ...next, page: 1 }, 'filters');
  };
  const active = [
    ...(query.minPricePaise === undefined
      ? []
      : [
          {
            key: 'minPricePaise' as const,
            label: `Minimum: ${formatPrice(query.minPricePaise, { showPaise: true })}`,
          },
        ]),
    ...(query.maxPricePaise === undefined
      ? []
      : [
          {
            key: 'maxPricePaise' as const,
            label: `Maximum: ${formatPrice(query.maxPricePaise, { showPaise: true })}`,
          },
        ]),
    ...(query.store
      ? [
          {
            key: 'store' as const,
            label: `Vendor: ${stores.find((store) => store.slug === query.store)?.name ?? query.store}`,
          },
        ]
      : []),
  ];

  return (
    <>
      <CategoryBreadcrumb category={category} />
      <h1 className={typography.pageTitle}>
        {language === 'hi' && category.nameHi ? category.nameHi : category.name}
      </h1>
      {category.children.length > 0 && (
        <nav aria-label="Subcategories" className="mt-4 flex flex-wrap gap-2">
          {category.children.map((child) => (
            <Link
              key={child.slug}
              href={`/c/${encodeURIComponent(child.slug)}`}
              className={cn(
                'inline-flex min-h-11 items-center rounded-full border border-slate-300 bg-white px-4 text-sm hover:bg-navy-50',
                focusRing,
              )}
            >
              {language === 'hi' && child.nameHi ? child.nameHi : child.name}
            </Link>
          ))}
        </nav>
      )}
      <div className="mt-8 flex items-start gap-6">
        <aside
          aria-label="Product filters"
          className="hidden w-56 shrink-0 space-y-5 rounded-lg border border-slate-200 bg-white p-4 lg:block"
        >
          <h2 className="text-lg font-semibold">Filters ({active.length})</h2>
          <CategoryFilters query={query} stores={stores} onApply={apply} />
        </aside>
        <div ref={listRef} className="min-w-0 flex-1 scroll-mt-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p role="status" className="text-sm text-slate-500">
              {data.total !== undefined
                ? `${data.total} products`
                : data.status === 'error'
                  ? 'Products unavailable'
                  : 'Loading products…'}
            </p>
            <label className="flex items-center gap-2 text-sm">
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
                {SORTS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="w-full lg:hidden">
              <Button variant="secondary" onClick={() => setMobile(true)}>
                Filters ({active.length})
              </Button>
            </div>
          </div>
          {storeError && (
            <div className="mb-4 text-sm text-slate-500">
              Store choices are unavailable.{' '}
              <Button variant="link" onClick={() => setStoreAttempt((value) => value + 1)}>
                Retry stores
              </Button>
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
              <Button variant="link" onClick={() => apply({ sort: query.sort, page: 1 })}>
                Clear all filters
              </Button>
            </div>
          )}
          <div aria-busy={data.status === 'loading' || pending}>
            <div className={cn('grid auto-rows-fr gap-4', GRID)}>
              {data.products.map((product) => (
                <div key={product.id} data-category-product>
                  <ProductCard product={product} showUnrated />
                </div>
              ))}
            </div>
            {data.status === 'loading' && (
              <div className={data.products.length ? 'mt-4' : ''}>
                <span className="sr-only" role="status">
                  Loading products
                </span>
                <SectionSkeleton
                  cards={data.products.length ? 4 : 8}
                  title={false}
                  gridClassName={GRID}
                />
              </div>
            )}
            {data.status === 'error' && (
              <div className="mt-6">
                <SectionError
                  message={
                    data.products.length
                      ? 'We couldn’t load more products. Your results are still here.'
                      : 'We couldn’t load these products.'
                  }
                  onRetry={data.retry}
                />
              </div>
            )}
            {data.status === 'ready' && data.products.length === 0 && (
              <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
                <h2 className="text-lg font-semibold">
                  {active.length
                    ? 'No products match these filters'
                    : 'No products in this category yet'}
                </h2>
                <p className="mt-3 text-slate-500">
                  {active.length
                    ? 'Try a wider price range or a different vendor.'
                    : 'Explore another category or check back soon.'}
                </p>
                {active.length > 0 && (
                  <div className="mx-auto mt-5 max-w-xs">
                    <Button
                      variant="secondary"
                      onClick={() => apply({ sort: query.sort, page: 1 })}
                    >
                      Clear all filters
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div ref={sentinelRef} aria-hidden="true" className="h-1" />
          {canLoadMore && (
            <div className="mx-auto mt-6 max-w-xs">
              <Button variant="secondary" onClick={loadMore}>
                Load more products
              </Button>
            </div>
          )}
          {data.status === 'ready' &&
            data.products.length > 0 &&
            query.page >= (data.totalPages ?? 1) && (
              <p role="status" className="py-8 text-center text-slate-500">
                You’ve seen all products.
              </p>
            )}
        </div>
      </div>
      <Dialog
        open={mobile}
        title={`Filters (${active.length})`}
        variant="drawer"
        onClose={() => setMobile(false)}
      >
        {mobile && <CategoryFilters mobile query={query} stores={stores} onApply={apply} />}
      </Dialog>
    </>
  );
}

export function CategoryPage({ slug }: { slug: string }) {
  const [category, setCategory] = useState<CategoryDetail | null>(null);
  const [error, setError] = useState<'missing' | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setCategory(null);
    setError(null);
    void loadCategory(slug)
      .then((value) => {
        if (!cancelled) setCategory(value);
      })
      .catch((reason: unknown) => {
        if (!cancelled)
          setError(reason instanceof ApiError && reason.status === 404 ? 'missing' : 'error');
      });
    return () => {
      cancelled = true;
    };
  }, [slug, attempt]);

  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="w-full px-4 py-8 sm:px-6 lg:px-8">
        {error === 'missing' ? (
          <div className="py-12 text-center">
            <h1 className={typography.pageTitle}>Category not found</h1>
            <Link
              className={cn(
                'mt-5 inline-flex min-h-11 items-center rounded-lg text-teal-600',
                focusRing,
              )}
              href="/"
            >
              Browse all categories
            </Link>
          </div>
        ) : error ? (
          <SectionError
            message="We couldn’t load this category."
            onRetry={() => setAttempt((value) => value + 1)}
          />
        ) : category?.slug === slug ? (
          <CategoryListing key={slug} category={category} />
        ) : (
          <SectionSkeleton cards={8} gridClassName={GRID} />
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
