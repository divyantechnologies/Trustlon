'use client';
import Link from 'next/link';
import { useHome } from '../home-provider';
import type { Store } from '../types';
import { ScrollSection } from './ScrollSection';
import { ProductImage } from './ProductImage';
import { Icon } from './Icon';
export function FeaturedBrandStores({
  showViewAll = true,
  stores,
}: {
  showViewAll?: boolean;
  /** Defaults to the featured stores from the home page data. */
  stores?: Store[];
}) {
  const featured = useHome().home?.featuredStores ?? [];
  const list = stores ?? featured;
  if (list.length === 0) return null;
  return (
    <ScrollSection
      title="Great brands. Verified by us."
      subtitle="Discover the people and brands behind your next favourite find."
      href={showViewAll ? '/browse/stores' : undefined}
      wide
    >
      {list.map((store) => (
        <Link
          key={store.slug}
          href={`/browse/${store.slug}`}
          className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <ProductImage src={store.image ?? ''} alt="" className="h-32 w-full object-cover" />
          <div className="relative p-5">
            <span className="-mt-11 mb-3 flex h-14 w-14 items-center justify-center rounded-lg border-4 border-white bg-navy-50 text-lg font-bold tracking-tight">
              {store.initials}
            </span>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold group-hover:text-teal-600">{store.name}</h3>
              {store.isVerified && (
                <Icon name="shield" className="h-4 w-4 text-teal-600" aria-label="Verified" />
              )}
            </div>
            {store.tagline && <p className="mt-1 text-xs text-slate-500">{store.tagline}</p>}
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px]">
              <span className="text-slate-500">
                {store.isVerified ? 'Trustlon Verified' : 'Brand store'}
              </span>
              <span className="rounded bg-teal-50 px-2 py-1 font-medium text-teal-600">
                Trust Score {store.trustScore}/100
              </span>
            </div>
          </div>
        </Link>
      ))}
    </ScrollSection>
  );
}
