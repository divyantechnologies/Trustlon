'use client';
import type { CategoryConfig } from '../categoryConfig';
import type { Product, Selection } from '../types';
import { money } from '../helpers';
export function VariantSelector({
  product,
  config,
  selection,
  onChange,
}: {
  product: Product;
  config: CategoryConfig;
  selection: Selection;
  onChange: (v: Selection) => void;
}) {
  const rank = (v: string) => {
    const n = config.variantOrder.indexOf(v.toLowerCase().replace(/\s+/g, '-'));
    return n < 0 ? 99 : n;
  };
  return (
    <div className="space-y-5">
      {product.variants
        ?.slice()
        .sort((a, b) => rank(a.type) - rank(b.type))
        .filter((v) => v.options.length)
        .map((v) => (
          <fieldset key={v.type}>
            <legend className="mb-2 text-sm font-semibold">
              {v.label}: <span className="font-normal text-slate-500">{selection[v.type]}</span>
            </legend>
            <div className="flex flex-wrap gap-2">
              {v.options.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={selection[v.type] === o.value}
                  disabled={!o.available || o.stock?.status === 'out' || o.stock?.quantity === 0}
                  onClick={() => onChange({ ...selection, [v.type]: o.value })}
                  className={`min-h-11 rounded-xl border px-4 py-2 text-sm disabled:text-slate-400 disabled:line-through ${selection[v.type] === o.value ? 'border-teal-600 bg-teal-50 text-teal-900 ring-1 ring-teal-600' : 'border-slate-300 bg-white'}`}
                >
                  {o.value}
                  {o.priceDelta ? (
                    <span className="ml-1 text-xs">
                      ({o.priceDelta > 0 ? '+' : '−'}
                      {money(Math.abs(o.priceDelta))})
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </fieldset>
        ))}
    </div>
  );
}
