import type { Product } from '../types';
import type { CategoryConfig } from '../categoryConfig';
import { Icon } from './primitives';

type SummaryProduct = Product & {
  policies?: Product['policies'] & { deliveryEstimate?: string };
};

export function ProductSummaryBlock({ product, config }: {
  product: SummaryProduct;
  config: CategoryConfig;
}) {
  const overview = product.description?.overview?.trim();
  const features = product.keyFeatures?.filter((text) => text.trim()).slice(0, 5) ?? [];
  const highlights = product.highlights ?? [];
  const offers = product.offers?.slice(0, 3) ?? [];
  const policies = product.policies;
  const info = [
    { label: 'Delivery', value: policies?.deliveryEstimate, icon: 'box' },
    { label: 'Returns', value: policies?.returns, icon: 'box' },
    { label: 'Warranty', value: policies?.warranty, icon: 'shield' },
  ].filter((item) => item.value?.trim());
  if (!overview && !features.length && !highlights.length && !offers.length && !info.length) return null;

  return (
    <section aria-label="Product summary" className="space-y-5 text-[#12203F]">
      {overview && (
        <div>
          <p className="line-clamp-3 text-sm leading-6 text-slate-600">{overview}</p>
          {config.sectionOrder.includes('description') && (
            <a href="#description" className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-teal-700 underline underline-offset-4">Read more</a>
          )}
        </div>
      )}
      {!!features.length && (
        <ul aria-label="Key features" className="space-y-2 text-sm leading-6 text-slate-600">
          {features.map((feature, index) => (
            <li key={index} className="flex gap-2">
              <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" className="mt-1 h-4 w-4 shrink-0 text-teal-700">
                <path d="m4 10 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      )}
      {!!highlights.length && (
        <div className="grid grid-cols-2 gap-3">
          {highlights.map((highlight, index) => (
            <div key={index} className="flex min-w-0 gap-3 rounded-xl bg-[#eef5f3] p-3">
              <span className="shrink-0 text-teal-700"><Icon name={highlight.icon ?? config.highlightIcons[highlight.label] ?? config.defaultIcon} /></span>
              <div className="min-w-0 break-words">
                <p className="text-xs text-slate-600">{highlight.label}</p>
                {highlight.value && <p className="mt-1 text-sm font-semibold">{highlight.value}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
      {!!offers.length && (
        <div className="border-t border-slate-200 pt-5">
          <div className="grid gap-3 sm:grid-cols-2">
            {offers.map((offer, index) => (
              <article key={index} className="rounded-2xl border border-teal-100 bg-teal-50/40 p-3">
                <h3 className="text-sm font-semibold">{offer.title}</h3>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{offer.description}</p>
              </article>
            ))}
          </div>
          {config.sectionOrder.includes('offers') && (
            <a href="#offers" className="mt-1 inline-flex min-h-10 items-center text-sm font-medium text-teal-700 underline underline-offset-4">View all offers</a>
          )}
        </div>
      )}
      {!!info.length && (
        <div className="grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-3">
          {info.map((item) => (
            <div key={item.label} className="flex gap-2">
              <span className="shrink-0 text-teal-700"><Icon name={item.icon} /></span>
              <div>
                <p className="text-xs font-semibold">{item.label}</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
