'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, typography } from '@/design-system';
import { ApiError } from '@/lib/http';
import { homeApi } from './api';
import { CategoryNav } from './components/CategoryNav';
import { FeaturedBrandStores } from './components/FeaturedBrandStores';
import { HomeFooter } from './components/HomeFooter';
import { HomeHeader } from './components/HomeHeader';
import { LocalSellersStrip } from './components/LocalSellersStrip';
import { MarketplaceDialogs } from './components/MarketplaceDialogs';
import { ProductCard } from './components/ProductCard';
import { SectionError, SectionSkeleton } from './components/SectionStates';
import type { Product, ProductQuery, ProductSort, Store } from './types';

/** Pages that are not built yet. They show a short note instead of products. */
const informational: Record<string, string> = {
  account: 'Your account',
  orders: 'Your orders',
  help: 'Help centre',
  about: 'About Trustlon',
  story: 'Our story',
  careers: 'Careers at Trustlon',
  sell: 'Sell on Trustlon',
  returns: 'Returns & refunds',
  contact: 'Contact Trustlon',
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  shipping: 'Shipping policy',
  protection: 'Buyer protection',
  instagram: 'Trustlon on Instagram',
  facebook: 'Trustlon on Facebook',
  youtube: 'Trustlon on YouTube',
  app: 'The Trustlon app',
};

/** Fixed collections and the product filter each one uses. */
const collections: Record<string, { title: string; subtitle: string; query: ProductQuery }> = {
  search: { title: 'Search results', subtitle: '', query: {} },
  deals: { title: 'Today’s deals', subtitle: 'Limited-time prices from verified sellers.', query: { deals: true } },
  originals: { title: 'Trustlon Originals', subtitle: 'Thoughtful design. Honest prices.', query: { originals: true } },
  combos: { title: 'Combo products', subtitle: 'Bundles that save more when bought together.', query: { bundle: true } },
  everyday: { title: 'The everyday collection', subtitle: 'Popular picks across the marketplace.', query: { sort: 'popularity' } },
};

const SORTS: Array<{ value: ProductSort; label: string }> = [
  { value: 'relevance', label: 'Relevance' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
  { value: 'rating', label: 'Rating' },
];

type Target =
  | { kind: 'info'; title: string }
  | { kind: 'stores'; title: string }
  | { kind: 'local'; title: string }
  | { kind: 'recommended'; title: string }
  | { kind: 'products'; title: string; subtitle: string; query: ProductQuery }
  | { kind: 'missing' };

/** Works out what a /browse/:slug URL points to: a collection, a category or a store. */
function useTarget(slug: string, q: string): Target | null {
  const [target, setTarget] = useState<Target | null>(null);
  useEffect(() => {
    let cancelled = false;
    const done = (value: Target) => !cancelled && setTarget(value);
    setTarget(null);

    if (informational[slug]) done({ kind: 'info', title: informational[slug] });
    else if (slug === 'stores') done({ kind: 'stores', title: 'Verified brand stores' });
    else if (slug === 'local') done({ kind: 'local', title: 'Neighbourhood favourites' });
    else if (slug === 'recommended') done({ kind: 'recommended', title: 'Picked for you' });
    else if (collections[slug]) {
      const c = collections[slug];
      done({
        kind: 'products',
        title: c.title,
        subtitle: slug === 'search' ? (q ? `Results for “${q}”` : 'All products') : c.subtitle,
        query: slug === 'search' ? { q } : c.query,
      });
    } else {
      (async () => {
        try {
          const category = await homeApi.category(slug);
          const parent = category.breadcrumb.length > 1 ? category.breadcrumb[0].name : null;
          done({
            kind: 'products',
            title: category.name,
            subtitle: parent ? `In ${parent}` : `${category.children.length} sections to explore`,
            query: { category: slug },
          });
          return;
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        try {
          const store = await homeApi.store(slug);
          done({
            kind: 'products',
            title: store.name,
            subtitle: [store.tagline, store.isVerified ? `Trust Score ${store.trustScore}/100` : null]
              .filter(Boolean)
              .join(' · '),
            query: { store: slug },
          });
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) done({ kind: 'missing' });
          else throw error;
        }
      })().catch(() => done({ kind: 'missing' }));
    }
    return () => {
      cancelled = true;
    };
  }, [slug, q]);
  return target;
}

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  );
}

function ProductList({ query }: { query: ProductQuery }) {
  const [sort, setSort] = useState<ProductSort>(query.sort ?? 'relevance');
  const [items, setItems] = useState<Product[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const key = JSON.stringify(query);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [key, sort]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    homeApi
      .products({ ...query, sort, page, pageSize: 20 }, controller.signal)
      .then((result) => {
        setItems((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
    // `key` stands for `query`, which is a new object on every render.
  }, [key, sort, page, attempt]);

  if (state === 'error' && items.length === 0) {
    return <SectionError message="We couldn’t load these products." onRetry={() => setAttempt((n) => n + 1)} />;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500" aria-live="polite">
          {state === 'loading' && items.length === 0 ? 'Loading…' : `${total} products`}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-slate-500">Sort by</span>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ProductSort)}
            className="h-11 rounded-lg border border-slate-300 bg-white px-3"
          >
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      {state === 'loading' && items.length === 0 ? (
        <SectionSkeleton cards={10} title={false} />
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-slate-500">No matching products. Try a different search.</p>
      ) : (
        <>
          <ProductGrid products={items} />
          {page < totalPages && (
            <div className="mx-auto mt-8 w-48">
              <Button variant="secondary" loading={state === 'loading'} onClick={() => setPage((p) => p + 1)}>
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function VerifiedStores() {
  const [stores, setStores] = useState<Store[] | null>(null);
  useEffect(() => {
    homeApi
      .verifiedStores()
      .then((data) => setStores(data.items))
      .catch(() => setStores([]));
  }, []);
  if (stores === null) return <SectionSkeleton cards={4} title={false} />;
  return <FeaturedBrandStores showViewAll={false} stores={stores} />;
}

function Recommended() {
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    homeApi
      .recommendations(20)
      .then((data) => setItems(data.items))
      .catch(() => setItems([]));
  }, []);
  if (items === null) return <SectionSkeleton cards={10} title={false} />;
  return <ProductGrid products={items} />;
}

export function BrowsePage() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams();
  const q = params.get('q') ?? '';
  const target = useTarget(slug, q);

  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/" className="mb-6 inline-flex min-h-11 items-center text-teal-600">
          ← Back to home
        </Link>
        {target === null ? (
          <SectionSkeleton />
        ) : target.kind === 'missing' ? (
          <>
            <h1 className={typography.pageTitle}>We couldn’t find this page</h1>
            <p className="mt-3 text-slate-500">It may have moved. Try searching or browsing a category.</p>
          </>
        ) : (
          <>
            <h1 className={typography.pageTitle}>{target.title}</h1>
            {target.kind === 'products' && target.subtitle && (
              <p className="mb-8 mt-3 text-slate-500">{target.subtitle}</p>
            )}
            <div className={target.kind === 'products' && target.subtitle ? '' : 'mt-8'}>
              {target.kind === 'info' && (
                <div className="max-w-xl">
                  <Alert tone="info">This page is coming soon.</Alert>
                </div>
              )}
              {target.kind === 'stores' && <VerifiedStores />}
              {target.kind === 'local' && <LocalSellersStrip showViewAll={false} />}
              {target.kind === 'recommended' && <Recommended />}
              {target.kind === 'products' && <ProductList query={target.query} />}
            </div>
          </>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
