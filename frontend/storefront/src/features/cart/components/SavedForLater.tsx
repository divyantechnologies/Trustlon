'use client';

import type { CartItemView } from '../types';
import { card, ProductImage, secondary } from '../../product/components/primitives';
import { money } from '../../product/helpers';

export function SavedForLater({
  items,
  busy,
  onMove,
}: {
  items: CartItemView[];
  busy: boolean;
  onMove: (id: string) => void;
}) {
  if (!items.length) return null;

  return (
    <section className={card} aria-label="Saved for later">
      <h2 className="text-xl font-semibold text-[#12203F]">Saved for later ({items.length})</h2>
      <div className="divide-y divide-slate-100">
        {items.map((item) => (
          <article key={item.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <ProductImage
                src={item.image}
                alt={item.title}
                className="h-16 w-16 rounded-lg object-contain shrink-0"
              />
              <div className="min-w-0 flex-1">
                <a
                  href={`/p/${encodeURIComponent(item.slug || item.productId)}`}
                  className="font-medium text-[#12203F] hover:text-teal-700 block truncate"
                >
                  {item.title}
                </a>
                <p className="text-sm font-semibold text-[#12203F]">
                  {money(item.price / 100)}
                </p>
                {item.notice && (
                  <p className="text-xs text-slate-500">{item.notice}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              className={secondary}
              disabled={busy || item.maxQuantity === 0}
              onClick={() => onMove(item.id)}
              aria-label={`Move ${item.title} to cart`}
            >
              Move to cart
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
