'use client';
import type { ReactNode } from 'react';
import { type CategoryConfig, type SectionId, sectionLabels } from '../categoryConfig';
import type { Product, ProductActions } from '../types';
import { historyWindow } from '../helpers';
import { card } from './primitives';
import { OffersTabs } from './OffersTabs';
import { DescriptionBlocks } from './DescriptionBlocks';
import { SpecsAccordion } from './SpecsAccordion';
import { CategoryWidgets } from './CategoryWidgets';
import { ReviewSummary } from './ReviewSummary';
import { ReviewList } from './ReviewList';
import { QnA } from './QnA';
import { PolicyCards, policyItems } from './PolicyCards';
import { PriceHistoryChart } from './PriceHistoryChart';
import { ProductCarousel } from './ProductCarousel';
export type RelatedProducts = { similar: Product[]; together: Product[]; recent: Product[] };
export function availableSections(
  product: Product,
  config: CategoryConfig,
  related: RelatedProducts,
): SectionId[] {
  const d = product.description;
  const present: Record<SectionId, boolean> = {
    offers: Boolean(product.offers?.length),
    description: Boolean(d?.overview || d?.blocks?.length || d?.inTheBox?.length),
    specs: Boolean(product.specs?.some((s) => s.items.length)),
    widgets: config.widgets.some((w) => {
      const d = product.widgets?.[w.key];
      return Boolean(d && (d.text || d.rows?.length || d.table?.length || d.url));
    }),
    reviews: true,
    qna: true,
    policies: policyItems(product.policies).length > 0,
    history: historyWindow(product).length > 0,
    together: related.together.length > 0,
    similar: related.similar.length > 0,
    recent: related.recent.length > 0,
  };
  return [...new Set(config.sectionOrder)].filter((key) => present[key]);
}
export function SectionRenderer({
  product,
  config,
  related,
  actions,
  tabsOnly = false,
}: {
  product: Product;
  config: CategoryConfig;
  related: RelatedProducts;
  actions: ProductActions;
  tabsOnly?: boolean;
}) {
  const sections = availableSections(product, config, related);
  if (tabsOnly)
    return (
      <nav
        aria-label="Product sections"
        className="sticky top-0 z-20 -mx-4 flex gap-1 overflow-x-auto border-y border-slate-200 bg-[#fafaf8]/95 px-4 backdrop-blur sm:mx-0 sm:rounded-xl"
      >
        <a
          href="#overview"
          className="min-h-14 shrink-0 px-4 py-4 text-sm font-semibold text-teal-800"
        >
          Overview
        </a>
        {sections.map((key) => (
          <a
            key={key}
            href={`#${key}`}
            className="min-h-14 shrink-0 px-4 py-4 text-sm text-slate-600 hover:text-teal-700"
          >
            {sectionLabels[key]}
          </a>
        ))}
      </nav>
    );
  const content: Record<SectionId, () => ReactNode> = {
    offers: () => <OffersTabs offers={product.offers} />,
    description: () => <DescriptionBlocks description={product.description} config={config} />,
    specs: () => <SpecsAccordion specs={product.specs} config={config} />,
    widgets: () => <CategoryWidgets product={product} config={config} />,
    reviews: () => (
      <>
        <ReviewSummary rating={product.rating} config={config} />
        <ReviewList reviews={product.reviews} vote={actions.vote} />
      </>
    ),
    qna: () => <QnA product={product} actions={actions} />,
    policies: () => <PolicyCards policies={product.policies} />,
    history: () => <PriceHistoryChart product={product} setAlert={actions.setAlert} />,
    together: () => (
      <ProductCarousel
        products={[product, ...related.together.filter((p) => p.id !== product.id)]}
        together
        addToCart={actions.addToCart}
      />
    ),
    similar: () => <ProductCarousel products={related.similar} addToCart={actions.addToCart} />,
    recent: () => <ProductCarousel products={related.recent} addToCart={actions.addToCart} />,
  };
  return (
    <div className="space-y-6">
      {sections.map((key) => (
        <section
          key={key}
          id={key}
          aria-labelledby={`${key}-heading`}
          className={`${card} scroll-mt-20`}
        >
          <h2
            id={`${key}-heading`}
            className="mb-5 text-xl font-semibold tracking-tight sm:text-2xl"
          >
            {sectionLabels[key]}
          </h2>
          {content[key]()}
        </section>
      ))}
    </div>
  );
}
