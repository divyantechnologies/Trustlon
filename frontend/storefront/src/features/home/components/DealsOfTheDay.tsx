'use client';
import { useEffect, useState } from 'react';
import { dealIds, products } from '../data/products';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
export function DealsOfTheDay() {
  const [remaining, setRemaining] = useState(8 * 60 * 60 + 24 * 60);
  useEffect(() => {
    const end = Date.now() + (8 * 60 * 60 + 24 * 60) * 1000;
    const interval = window.setInterval(
      () => setRemaining(Math.max(0, Math.floor((end - Date.now()) / 1000))),
      1000,
    );
    return () => window.clearInterval(interval);
  }, []);
  const time = [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
    .map((n) => String(n).padStart(2, '0'))
    .join(' : ');
  return (
    <ScrollSection
      title="Deals of the day"
      subtitle="Great finds. Even better prices. A fresh reason to treat yourself."
      href="/browse/deals"
      aside={
        <span className="rounded-lg bg-navy-50 px-3 py-2 text-xs">
          <span className="mr-2 text-slate-500">Demo ends in</span>
          <span className="font-semibold tabular-nums">{remaining ? time : 'Offer ended'}</span>
        </span>
      }
    >
      {products
        .filter((p) => dealIds.includes(p.id))
        .map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
    </ScrollSection>
  );
}
