'use client';
import Link from 'next/link';
import { Button, cn, focusRing } from '@/design-system';
import { useHome } from '../home/home-provider';
import { ProductCard } from '../home/components/ProductCard';

export function NoResultsState({
  query,
  filtered,
  onClear,
}: {
  query: string;
  filtered: boolean;
  onClear: () => void;
}) {
  const { home } = useHome();
  const categories = [...(home?.categories ?? [])]
    .sort(
      (a, b) =>
        Number(b.name.toLowerCase().includes(query.toLowerCase())) -
        Number(a.name.toLowerCase().includes(query.toLowerCase())),
    )
    .slice(0, 6);
  const popular = home?.trending.slice(0, 4) ?? [];
  return (
    <div className="space-y-8">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center sm:p-8">
        <h2 className="text-lg font-semibold">No products found</h2>
        <p className="mt-3 break-words text-slate-500">
          {query
            ? `No products matched “${query}”${filtered ? ' with these filters' : ''}.`
            : 'No products match these filters.'}{' '}
          Try fewer words, check the spelling or broaden your filters.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          {filtered && (
            <Button variant="secondary" onClick={onClear}>
              Clear all filters
            </Button>
          )}
          <Button
            variant="link"
            onClick={() => {
              document.querySelector<HTMLInputElement>('form[role="search"] input')?.focus();
            }}
          >
            Modify search
          </Button>
          <Link
            href="/"
            className={cn(
              'inline-flex min-h-11 items-center rounded-lg px-3 text-teal-600 underline',
              focusRing,
            )}
          >
            Browse categories
          </Link>
        </div>
        {categories.length > 0 && (
          <nav
            aria-label="Suggested categories"
            className="mt-6 flex flex-wrap justify-center gap-2"
          >
            {categories.map((category) => (
              <Link
                key={category.slug}
                href={`/c/${encodeURIComponent(category.slug)}`}
                className={cn(
                  'inline-flex min-h-11 items-center rounded-full border border-slate-300 px-4 text-sm hover:bg-navy-50',
                  focusRing,
                )}
              >
                {category.name}
              </Link>
            ))}
          </nav>
        )}
      </div>
      {popular.length > 0 && (
        <section aria-labelledby="popular-search-products">
          <h2 id="popular-search-products" className="mb-5 text-lg font-semibold">
            Popular products to explore
          </h2>
          <div className="grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
            {popular.map((product) => (
              <ProductCard key={product.id} product={product} showUnrated />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
