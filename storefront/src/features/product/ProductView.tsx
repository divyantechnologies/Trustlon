'use client';
import { useEffect, useState } from 'react';
import type { Product, ProductActions } from './types';
import { getCategoryConfig } from './categoryConfig';
import { initialSelection, number, resolveSelection } from './helpers';
import { ProductGallery } from './components/ProductGallery';
import { VariantSelector } from './components/VariantSelector';
import { ProductSummaryBlock } from './components/ProductSummaryBlock';
import { BuyBox, PriceBlock } from './components/BuyBox';
import { SectionRenderer, type RelatedProducts } from './components/SectionRenderer';
const emptyRelated: RelatedProducts = { similar: [], together: [], recent: [] };
/** Pure, provider-independent template. All commerce effects are injected at the route boundary. */
export function ProductView({
  product,
  actions,
  related = emptyRelated,
  wishlisted = false,
}: {
  product: Product;
  actions: ProductActions;
  related?: RelatedProducts;
  wishlisted?: boolean;
}) {
  const config = getCategoryConfig(product.category);
  const [selection, setSelection] = useState(() => initialSelection(product));
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const resolved = resolveSelection(product, selection);
  const selected = resolved.product;
  useEffect(() => {
    setQuantity(1);
    setNotice('');
  }, [selection]);
  const purchase = { product: selected, quantity, selections: selection, skuId: resolved.skuId };
  async function onPurchase(buy: boolean) {
    if (busy || !resolved.canBuy) return;
    setBusy(true);
    setNotice('');
    try {
      await (buy ? actions.buyNow : actions.addToCart)(purchase);
      if (!buy) setNotice('Added to your cart.');
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  const buyProps = {
    purchase,
    actions,
    canBuy: resolved.canBuy,
    wishlisted,
    quantity,
    onQuantity: setQuantity,
    busy,
    onPurchase,
  };
  return (
    <main className="pdp mx-auto max-w-[1560px] space-y-6 px-4 py-6 pb-28 text-[#12203F] sm:px-6 lg:px-8">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-2 text-xs text-slate-500"
      >
        <a href="/" className="hover:text-teal-700">
          Home
        </a>
        {product.category.path.map((name, i) => (
          <span key={`${name}-${i}`} className="flex gap-2">
            <span aria-hidden="true">/</span>
            {i === product.category.path.length - 1 ? (
              <a href={`/c/${encodeURIComponent(product.category.id)}`}>{name}</a>
            ) : (
              <span>{name}</span>
            )}
          </span>
        ))}
        <span aria-hidden="true">/</span>
        <span aria-current="page" className="max-w-64 truncate text-slate-700">
          {product.title}
        </span>
      </nav>
      <SectionRenderer
        product={product}
        config={config}
        actions={actions}
        related={related}
        tabsOnly
      />
      <div
        id="overview"
        className="grid scroll-mt-20 items-start gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_310px]"
      >
        <ProductGallery product={product} selectedImage={resolved.selectedImage} />
        <div className="min-w-0 space-y-6 py-2">
          <div>
            {product.brand && (
              <a
                href={`/search?q=${encodeURIComponent(product.brand)}`}
                className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700"
              >
                {product.brand}
              </a>
            )}
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {product.title}
            </h1>
            {product.rating?.count ? (
              <a href="#reviews" className="mt-4 inline-flex items-center gap-3 text-sm">
                <span className="rounded-lg bg-teal-700 px-2.5 py-1 text-white">
                  ★ {product.rating.average.toFixed(1)}
                </span>
                <span className="text-slate-500">{number(product.rating.count)} ratings</span>
              </a>
            ) : (
              <a href="#reviews" className="mt-3 inline-flex text-sm text-teal-700">
                Be the first to review
              </a>
            )}
          </div>
          <div className="border-y border-slate-200 py-5">
            <PriceBlock product={selected} />
          </div>
          <VariantSelector
            product={product}
            config={config}
            selection={selection}
            onChange={setSelection}
          />
          {config.widgets.some((w) => w.key === 'sizeChart') && product.widgets?.sizeChart && (
            <a
              href="#widgets"
              className="inline-flex min-h-11 items-center text-sm text-teal-700 underline"
            >
              Size guide
            </a>
          )}
          <ProductSummaryBlock product={product} config={config} />
        </div>
        <div className="lg:col-span-2 xl:col-span-1 xl:sticky xl:top-20">
          <BuyBox {...buyProps} />
        </div>
      </div>
      <p
        role="status"
        aria-live="polite"
        className={`text-sm ${notice ? 'rounded-xl border border-teal-200 bg-teal-50 p-4' : 'sr-only'}`}
      >
        {notice}
      </p>
      <SectionRenderer product={product} config={config} actions={actions} related={related} />
      <BuyBox {...buyProps} mobile />
    </main>
  );
}
