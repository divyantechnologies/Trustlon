import type { Product } from '../types';
import type { CategoryConfig } from '../categoryConfig';
import { Icon } from './primitives';
export function HighlightsGrid({ product, config }: { product: Product; config: CategoryConfig }) {
  if (!product.highlights?.length && !product.keyFeatures?.length) return null;
  return (
    <section aria-label="Product highlights" className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {product.highlights?.map((h, i) => (
          <div className="flex gap-3 rounded-xl bg-[#eef5f3] p-3" key={i}>
            <span className="text-teal-700">
              <Icon name={h.icon ?? config.highlightIcons[h.label] ?? config.defaultIcon} />
            </span>
            <div>
              <p className="text-xs text-slate-600">{h.label}</p>
              {h.value && <p className="mt-1 text-sm font-semibold">{h.value}</p>}
            </div>
          </div>
        ))}
      </div>
      {!!product.keyFeatures?.length && (
        <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
          {product.keyFeatures.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
