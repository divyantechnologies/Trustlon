'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { homeApi } from '../api';
import { useHome } from '../home-provider';
import type { LocalSeller } from '../types';
import { Icon } from './Icon';
export function LocalSellersStrip({ showViewAll = true }: { showViewAll?: boolean }) {
  const { pincode, setPanel } = useHome();
  const [sellers, setSellers] = useState<LocalSeller[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    setSellers(null);
    setFailed(false);
    homeApi
      .localSellers(pincode, 10, controller.signal)
      .then((data) => setSellers(data.sellers))
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [pincode]);
  return (
    <section
      className="rounded-lg border border-slate-200 bg-white p-5 sm:p-7"
      aria-labelledby="local-title"
      aria-busy={sellers === null && !failed}
    >
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 id="local-title" className="flex items-center gap-2 text-2xl font-semibold">
            <Icon name="pin" className="h-6 w-6 text-teal-600" />
            Good things, closer to home
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Neighbourhood sellers within 10 km of {pincode} ·{' '}
            <button className="font-medium text-teal-600 hover:underline" onClick={() => setPanel('pincode')}>
              Change
            </button>
          </p>
        </div>
        {showViewAll && sellers && sellers.length > 0 && (
          <Link
            href="/browse/local"
            className="inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-teal-600"
          >
            Explore local
            <Icon name="arrow" className="h-4 w-4" />
          </Link>
        )}
      </div>
      {failed ? (
        <p className="py-6 text-center text-sm text-slate-500">
          We couldn’t load local sellers right now. Please try again later.
        </p>
      ) : sellers === null ? (
        <div aria-hidden className="grid animate-pulse gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 rounded-lg bg-slate-100" />
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-500">
          No same-day sellers near {pincode} yet. Try another pincode.
        </p>
      ) : (
        <div className="grid grid-flow-col auto-cols-[90%] gap-4 overflow-x-auto pb-2 sm:auto-cols-[48%] lg:auto-cols-[calc((100%-2rem)/3)]">
          {sellers.map((seller) => (
            <Link
              key={seller.slug}
              href={`/browse/${seller.slug}`}
              className="flex gap-4 rounded-lg border border-slate-200 p-4 hover:border-teal/40"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-navy-50 text-lg font-semibold">
                {seller.initials}
              </span>
              <div>
                <h3 className="font-semibold">{seller.name}</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {seller.area ?? seller.pincode} · {seller.distanceKm.toFixed(1)} km away
                </p>
                {seller.category && <p className="mt-2 text-xs text-slate-500">{seller.category}</p>}
                {seller.sameDayDelivery && (
                  <span className="mt-3 inline-flex items-center gap-1 rounded bg-teal-50 px-2 py-1 text-[10px] text-teal-600">
                    <Icon name="truck" className="h-3 w-3" />
                    Same-day delivery
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
