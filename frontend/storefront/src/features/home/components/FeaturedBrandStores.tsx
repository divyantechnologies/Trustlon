import Link from 'next/link';
import { stores } from '../data/stores';
import { ScrollSection } from './ScrollSection';
import { ProductImage } from './ProductImage';
import { Icon } from './Icon';
export function FeaturedBrandStores({ showViewAll = true }: { showViewAll?: boolean }) {
  return (
    <ScrollSection
      title="Great brands. Verified by us."
      subtitle="Discover the people and brands behind your next favourite find."
      href={showViewAll ? '/browse/stores' : undefined}
      wide
    >
      {stores.map((store) => (
        <Link
          key={store.id}
          href={`/browse/${store.id}`}
          className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
        >
          <ProductImage src={store.image} alt="" className="h-32 w-full object-cover" />
          <div className="relative p-5">
            <span className="-mt-11 mb-3 flex h-14 w-14 items-center justify-center rounded-lg border-4 border-white bg-navy-50 text-lg font-bold tracking-tight">
              {store.initials}
            </span>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold group-hover:text-teal-600">{store.name}</h3>
              <Icon name="shield" className="h-4 w-4 text-teal-600" />
            </div>
            <p className="mt-1 text-xs text-slate-500">{store.description}</p>
            <div className="mt-5 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 text-[10px]">
              <span className="text-slate-500">Verified · Demo store</span>
              <span className="rounded bg-teal-50 px-2 py-1 font-medium text-teal-600">
                Trust Score {store.score}/100
              </span>
            </div>
          </div>
        </Link>
      ))}
    </ScrollSection>
  );
}
