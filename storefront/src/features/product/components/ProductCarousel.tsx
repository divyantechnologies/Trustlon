'use client';
import { useState } from 'react';
import type { Product, ProductActions } from '../types';
import { initialSelection, money, resolveSelection } from '../helpers';
import { ProductImage, button } from './primitives';
export function ProductCarousel({
  products,
  together = false,
  addToCart,
}: {
  products: Product[];
  together?: boolean;
  addToCart: ProductActions['addToCart'];
}) {
  const [selected, setSelected] = useState(products.map((p) => p.id));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const items = products.filter((p) => selected.includes(p.id));
  const resolved = items.map((p) => ({
    ...resolveSelection(p, initialSelection(p)),
    selections: initialSelection(p),
  }));
  return (
    <>
      <div className="flex snap-x gap-4 overflow-x-auto pb-4">
        {products.map((p) => (
          <article
            key={p.id}
            className="w-44 shrink-0 snap-start rounded-xl border border-slate-200 p-3 sm:w-56"
          >
            {together && (
              <label className="mb-2 flex min-h-8 items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  className="accent-teal-700"
                  checked={selected.includes(p.id)}
                  onChange={(e) =>
                    setSelected((v) =>
                      e.target.checked ? [...v, p.id] : v.filter((id) => id !== p.id),
                    )
                  }
                />
                Include in bundle
              </label>
            )}
            <a href={`/p/${encodeURIComponent(p.slug)}`} className="block">
              <ProductImage
                src={p.images[0]?.url}
                alt={p.images[0]?.alt ?? p.title}
                className="aspect-square w-full object-contain"
              />
              <p className="mt-3 line-clamp-2 min-h-10 text-sm font-medium">{p.title}</p>
              <p className="mt-2 font-semibold">
                {money(resolveSelection(p, initialSelection(p)).product.price.current)}
              </p>
            </a>
            {together && !!p.variants?.length && (
              <p className="mt-2 text-xs text-slate-500">
                {Object.values(initialSelection(p)).join(' · ')} · Select other options on product
                page
              </p>
            )}
          </article>
        ))}
      </div>
      {together && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-teal-50 p-4">
          <p className="font-semibold">
            {items.length} items ·{' '}
            {money(resolved.reduce((sum, p) => sum + p.product.price.current, 0))}
          </p>
          <button
            className={button}
            disabled={busy || !items.length || resolved.some((p) => !p.canBuy)}
            onClick={async () => {
              setBusy(true);
              let added = 0;
              try {
                for (const p of resolved) {
                  await addToCart({
                    product: p.product,
                    skuId: p.skuId,
                    selections: p.selections,
                    quantity: 1,
                  });
                  added++;
                }
                setNotice(`${added} items added to your cart.`);
              } catch (e) {
                setNotice(
                  `${added} items added. ${e instanceof Error ? e.message : 'Please try again.'}`,
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Add all to cart
          </button>
        </div>
      )}
      <p role="status" className="mt-2 text-sm text-teal-700">
        {notice}
      </p>
    </>
  );
}
