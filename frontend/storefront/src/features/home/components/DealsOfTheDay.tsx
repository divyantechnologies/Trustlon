'use client';
import { useEffect, useState } from 'react';
import { useHome } from '../home-provider';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
export function DealsOfTheDay() {
  const deals = useHome().home?.deals;
  const endsAt = deals?.endsAt ? new Date(deals.endsAt).getTime() : null;
  const [remaining, setRemaining] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((endsAt - Date.now()) / 1000)));
    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [endsAt]);
  if (!deals || deals.items.length === 0) return null;
  const time =
    remaining === null
      ? '-- : -- : --'
      : [Math.floor(remaining / 3600), Math.floor((remaining % 3600) / 60), remaining % 60]
          .map((n) => String(n).padStart(2, '0'))
          .join(' : ');
  return (
    <ScrollSection
      title="Deals of the day"
      subtitle="Great finds. Even better prices. A fresh reason to treat yourself."
      href="/browse/deals"
      aside={
        endsAt ? (
          <span className="rounded-lg bg-navy-50 px-3 py-2 text-xs">
            <span className="mr-2 text-slate-500">Ends in</span>
            <span className="font-semibold tabular-nums">{remaining === 0 ? 'Offer ended' : time}</span>
          </span>
        ) : undefined
      }
    >
      {deals.items.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </ScrollSection>
  );
}
