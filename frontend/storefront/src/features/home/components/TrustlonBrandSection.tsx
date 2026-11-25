'use client';
import Link from 'next/link';
import { useHome } from '../home-provider';
import { ProductCard } from './ProductCard';
import { Icon } from './Icon';
export function TrustlonBrandSection() {
  const originals = useHome().home?.originals ?? [];
  if (originals.length === 0) return null;
  return (
    <section
      className="rounded-lg border border-teal/15 bg-teal-50/60 p-5 sm:p-8"
      aria-labelledby="trustlon-originals"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-600">
            Made for your everyday
          </p>
          <h2 id="trustlon-originals" className="text-2xl font-semibold">
            Meet Trustlon Originals<span className="text-teal">.</span>
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Thoughtful design. Honest prices. Our name on every detail.
          </p>
        </div>
        <Link
          href="/browse/originals"
          className="inline-flex min-h-11 items-center gap-3 font-semibold text-teal-600"
        >
          Explore our brand
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 min-[360px]:grid-cols-2 lg:grid-cols-4">
        {originals.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
