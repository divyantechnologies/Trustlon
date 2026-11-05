import Link from 'next/link';
import { useHome } from '../home-provider';
import { sellers } from '../data/sellers';
import { Icon } from './Icon';
export function LocalSellersStrip({ showViewAll = true }: { showViewAll?: boolean }) {
  const { pincode } = useHome();
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-5 sm:p-7"
      aria-labelledby="local-title"
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="local-title" className="flex items-center gap-2 text-2xl font-semibold">
            <Icon name="pin" className="h-6 w-6 text-teal-600" />
            Good things, closer to home
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Meet your neighbourhood sellers · Demo location {pincode}
          </p>
        </div>
        {showViewAll && (
          <Link
            href="/browse/local"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-teal-600"
          >
            Explore local
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        )}
      </div>
      <div className="grid grid-flow-col auto-cols-[90%] gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:auto-cols-[calc((100%-2rem)/3)]">
        {sellers.map((seller) => (
          <Link
            key={seller.id}
            href={`/browse/${seller.id}`}
            className="flex gap-4 rounded-lg border border-slate-200 p-4 hover:border-teal/40"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-50 text-lg font-semibold">
              {seller.initials}
            </span>
            <div>
              <h3 className="font-semibold">{seller.name}</h3>
              <p className="mt-1 text-xs text-slate-500">
                {seller.location} · {pincode}
              </p>
              <p className="mt-2 text-xs text-slate-500">{seller.category}</p>
              <span className="mt-3 inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-1 text-[10px] text-teal-600">
                <Icon name="truck" className="h-3 w-3" />
                Same-day delivery · Demo
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
