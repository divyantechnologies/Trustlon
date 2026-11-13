'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, TextField, cn, focusRing, inputClass, typography } from '@/design-system';
import { ApiError } from '@/lib/http';
import { homeApi } from '../home/api';
import { useHome } from '../home/home-provider';
import { HomeHeader } from '../home/components/HomeHeader';
import { CategoryNav } from '../home/components/CategoryNav';
import { HomeFooter } from '../home/components/HomeFooter';
import { MarketplaceDialogs } from '../home/components/MarketplaceDialogs';
import { ProductCard } from '../home/components/ProductCard';
import { SectionSkeleton } from '../home/components/SectionStates';
import { formatPrice } from '../home/format';
import type { ProductDetail, Serviceability } from '../home/types';
import { MediaGallery } from './MediaGallery';

function DeliveryChecker({ product }: { product: ProductDetail }) {
  const home = useHome();
  const [pin, setPin] = useState(home.pincode);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [info, setInfo] = useState<Serviceability | null>(null);
  const [invalid, setInvalid] = useState(false);

  async function check(event: React.FormEvent) {
    event.preventDefault();
    const clean = pin.trim();
    if (!/^[1-9][0-9]{5}$/.test(clean)) {
      setInvalid(true);
      setStatus('idle');
      setInfo(null);
      return;
    }
    setInvalid(false);
    setStatus('loading');
    setInfo(null);
    try {
      const result = await homeApi.serviceability(clean);
      setInfo(result);
      setStatus('ready');
      if (result.serviceable) home.setPincode(clean);
    } catch {
      setStatus('error');
    }
  }

  const codAvailable = Boolean(info?.serviceable && product.codAvailable && info.codAvailable);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="font-semibold text-navy">Delivery availability</h2>
      <p className="mt-1 text-sm text-slate-500">Check service for this product by pincode.</p>
      <form onSubmit={check} className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <TextField
            label="Indian pincode"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))}
            error={invalid ? 'Enter a valid six-digit Indian pincode.' : undefined}
          />
        </div>
        <Button type="submit" loading={status === 'loading'}>Check</Button>
      </form>
      {status === 'ready' && info && (
        <div className="mt-4">
          {info.serviceable ? (
            <Alert tone="success">
              Delivery available{info.city ? ` to ${info.city}` : ''}
              {info.estimatedDeliveryDays !== null ? ` · Estimated in ${info.estimatedDeliveryDays} days` : ''}.
              {' '}Cash on delivery {codAvailable ? 'is available' : 'is not available'}.
            </Alert>
          ) : (
            <Alert tone="info">Delivery could not be confirmed for this pincode.</Alert>
          )}
        </div>
      )}
      {status === 'error' && <div className="mt-4"><Alert>We couldn’t check delivery. Please try again.</Alert></div>}
    </section>
  );
}

function BuyBox({ product }: { product: ProductDetail }) {
  const home = useHome();
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const maxQuantity = Math.max(0, product.maxQuantity);
  const canBuy = product.inStock && maxQuantity > 0;

  useEffect(() => setQuantity(1), [product.id]);

  async function addToCart() {
    if (!canBuy || adding || quantity < 1 || quantity > maxQuantity) return;
    setAdding(true);
    await home.addToCart(product, quantity);
    setAdding(false);
  }

  return (
    <aside className="min-w-0 rounded-xl border border-slate-200 bg-white p-5 xl:sticky xl:top-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-bold text-navy">{formatPrice(product.pricePaise, { showPaise: true })}</span>
        {product.mrpPaise > product.pricePaise && (
          <>
            <del className="text-sm text-slate-500">{formatPrice(product.mrpPaise, { showPaise: true })}</del>
            <span className="text-sm font-semibold text-teal-700">{product.discountPercent}% off</span>
          </>
        )}
      </div>
      <p className="mt-1 text-xs text-slate-500">Inclusive of applicable taxes</p>
      <p className={cn('mt-4 font-semibold', canBuy ? 'text-emerald-700' : 'text-red-600')}>
        {canBuy ? `In stock · ${maxQuantity} available` : 'Currently unavailable'}
      </p>
      {canBuy && (
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="text-sm font-medium">Quantity</span>
          <div className="inline-flex h-11 items-center rounded-lg border border-slate-300">
            <button
              type="button"
              aria-label="Decrease quantity"
              className="h-10 w-11 rounded-l-lg disabled:opacity-40"
              disabled={quantity <= 1 || adding}
              onClick={() => setQuantity((current) => Math.max(1, current - 1))}
            >−</button>
            <output aria-live="polite" className="min-w-8 text-center text-sm font-semibold">{quantity}</output>
            <button
              type="button"
              aria-label="Increase quantity"
              className="h-10 w-11 rounded-r-lg disabled:opacity-40"
              disabled={quantity >= maxQuantity || adding}
              onClick={() => setQuantity((current) => Math.min(maxQuantity, current + 1))}
            >+</button>
          </div>
        </div>
      )}
      <div className="mt-5 space-y-3">
        <Button disabled={!canBuy || adding} loading={adding} onClick={() => void addToCart()}>
          {canBuy ? 'Add to cart' : 'Out of stock'}
        </Button>
        <Button variant="secondary" disabled aria-describedby="checkout-unavailable">Buy now</Button>
        <p id="checkout-unavailable" className="text-xs text-slate-500">Checkout isn’t available in this storefront yet.</p>
        <Button
          variant="outline"
          aria-pressed={home.isWishlisted(product.id)}
          onClick={() => void home.toggleWishlist(product)}
        >
          {home.isWishlisted(product.id) ? '♥ Saved to wishlist' : '♡ Add to wishlist'}
        </Button>
      </div>
      <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm text-slate-600">
        <p>Sold by <Link href={`/browse/${encodeURIComponent(product.seller.slug)}`} className="font-medium text-teal-700 hover:underline">{product.seller.name}</Link></p>
        {product.seller.isVerified && <p className="text-emerald-700">Trustlon Verified seller</p>}
        {product.codAvailable && <p>Cash on delivery may be available in eligible areas.</p>}
        <p className="text-xs text-slate-500">Return eligibility and warranty information aren’t provided for this product.</p>
      </div>
    </aside>
  );
}

function ProductSpecifications({ product }: { product: ProductDetail }) {
  const rows = [
    ['Category', product.category.name],
    ['Brand', product.brand],
    ['Seller', product.seller.name],
    ['HSN code', product.hsnCode],
  ].filter((row): row is [string, string] => Boolean(row[1]?.trim()));
  if (!rows.length) return null;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-navy">Product specifications</h2>
      <dl className="mt-4 divide-y divide-slate-100">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 py-3 sm:grid-cols-[minmax(10rem,1fr)_2fr]">
            <dt className="text-sm text-slate-500">{label}</dt><dd className="text-sm font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function ProductDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > 700;
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-xl font-semibold text-navy">About this product</h2>
      <p className={cn('mt-4 whitespace-pre-line leading-7 text-slate-700', isLong && !expanded && 'line-clamp-6')}>
        {description}
      </p>
      {isLong && (
        <button className="mt-3 text-sm font-semibold text-teal-700 hover:underline" onClick={() => setExpanded((value) => !value)}>
          {expanded ? 'Read less' : 'Read more'}
        </button>
      )}
    </section>
  );
}

function DataLimitations({ product }: { product: ProductDetail }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-navy">Offers</h2>
        {product.deal ? (
          <p className="mt-2 text-sm text-slate-600">This product has an active deal price until {new Date(product.deal.endsAt).toLocaleDateString('en-IN')}.</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Coupon, bank offer, and Trustlon Coins details aren’t available for this product.</p>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-navy">Price history and alerts</h2>
        <p className="mt-2 text-sm text-slate-500">Price history and price alerts aren’t available through the current product API.</p>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-navy">Customer reviews</h2>
        {product.ratingCount > 0 ? (
          <p className="mt-2 text-sm text-slate-600">Current product summary: {product.rating.toFixed(1)} out of 5 from {product.ratingCount.toLocaleString('en-IN')} ratings. Review details aren’t available.</p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">No review summary or review details are available for this product.</p>
        )}
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-navy">Questions &amp; answers</h2>
        <p className="mt-2 text-sm text-slate-500">Customer questions and seller answers aren’t available through the current API.</p>
      </section>
    </div>
  );
}

function MobilePurchaseBar({ product }: { product: ProductDetail }) {
  const home = useHome();
  const [adding, setAdding] = useState(false);
  if (!product.inStock || product.maxQuantity < 1) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white p-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] xl:hidden">
      <div className="mx-auto flex max-w-screen-2xl items-center gap-3">
        <p className="min-w-0 flex-1 truncate font-semibold text-navy">{formatPrice(product.pricePaise)}</p>
        <Button
          className="!w-auto min-w-36"
          disabled={adding}
          loading={adding}
          onClick={async () => {
            if (adding) return;
            setAdding(true);
            await home.addToCart(product, 1);
            setAdding(false);
          }}
        >Add to cart</Button>
      </div>
    </div>
  );
}

export function ProductDetailsPage({ slug }: { slug: string }) {
  const home = useHome();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [similar, setSimilar] = useState<import('../home/types').Product[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const images = useMemo(() => product?.images?.length ? product.images : product ? [product.image] : [], [product]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    homeApi.product(slug, controller.signal)
      .then(({ product: found, similar: related }) => {
        if (controller.signal.aborted) return;
        setProduct(found);
        setSimilar(related.filter((item) => item.id !== found.id));
        setState('ready');
        void homeApi.recordView(found.id).catch(() => undefined);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'error');
      });
    return () => controller.abort();
  }, [slug, attempt]);

  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="w-full space-y-7 px-4 py-6 pb-24 sm:space-y-8 sm:px-6 lg:px-8">
        {state === 'loading' && <SectionSkeleton cards={2} />}
        {state === 'missing' && (
          <section className="py-20 text-center">
            <h1 className={typography.pageTitle}>Product not found</h1>
            <p className="mt-3 text-slate-600">This product may have been removed or the link may be incorrect.</p>
            <Link href="/" className={cn('mt-5 inline-flex min-h-11 items-center rounded-lg px-4 text-teal-700', focusRing)}>Continue shopping</Link>
          </section>
        )}
        {state === 'error' && (
          <Alert>We couldn’t load this product. <Button variant="link" onClick={() => setAttempt((value) => value + 1)}>Try again</Button></Alert>
        )}
        {state === 'ready' && product && (
          <>
            <nav aria-label="Breadcrumb" className="flex flex-wrap gap-2 text-sm text-slate-500">
              <Link href="/" className="text-teal-700 hover:underline">Home</Link><span aria-hidden>/</span>
              <Link href={`/c/${encodeURIComponent(product.category.slug)}`} className="text-teal-700 hover:underline">{product.category.name}</Link><span aria-hidden>/</span>
              <span aria-current="page" className="text-slate-700">{product.name}</span>
            </nav>

            <div className="grid min-w-0 gap-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_320px] xl:items-start">
              <MediaGallery name={product.name} images={images} />
              <section className="min-w-0 space-y-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-wider text-teal-700">
                    {product.brand ?? (product.seller.isPlatformOwned ? 'Trustlon Original' : product.seller.name)}
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold leading-tight text-navy sm:text-3xl">{product.name}</h1>
                  <p className="mt-2 text-sm text-slate-500">{product.category.name}</p>
                  {product.brand && <p className="mt-2 text-sm text-slate-600">Brand: {product.brand}</p>}
                </div>
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 pb-4">
                  {product.ratingCount > 0 ? (
                    <>
                      <span className="rounded bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-800">★ {product.rating.toFixed(1)} / 5</span>
                      <span className="text-sm text-slate-600">{product.ratingCount.toLocaleString('en-IN')} ratings</span>
                    </>
                  ) : <span className="text-sm text-slate-500">No ratings yet</span>}
                </div>
                {product.deal && <p className="text-sm font-medium text-rose-700">Limited time deal · Ends {new Date(product.deal.endsAt).toLocaleDateString('en-IN')}</p>}
                <div className="rounded-lg bg-slate-50 p-4 text-sm leading-6 text-slate-600">
                  <p>Brand: <span className="font-medium text-slate-800">{product.brand ?? 'Not specified'}</span></p>
                  <p>Seller: <span className="font-medium text-slate-800">{product.seller.name}</span></p>
                  <p>Fulfilment and return details are shown only where the current product data provides them.</p>
                </div>
              </section>
              <div className="lg:col-span-2 xl:col-span-1">
                <BuyBox product={product} />
              </div>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
              <DeliveryChecker key={product.id} product={product} />
              <section className="rounded-xl border border-slate-200 bg-white p-5">
                <h2 className="font-semibold text-navy">Purchase protection</h2>
                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                  {product.seller.isVerified && <li>✓ Trustlon Verified seller</li>}
                  <li>✓ Escrow protected purchase</li>
                  <li>✓ Secure payment options at checkout</li>
                </ul>
                <p className="mt-3 text-xs text-slate-500">Returns and authenticity eligibility aren’t specified in the product data.</p>
              </section>
            </div>

            <DataLimitations product={product} />
            {product.description && <ProductDescription description={product.description} />}
            <ProductSpecifications product={product} />
            {similar.length > 0 && (
              <section aria-labelledby="similar-products-heading">
                <h2 id="similar-products-heading" className="mb-4 text-xl font-semibold text-navy">Similar products</h2>
                <div className="grid auto-rows-fr grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
                  {similar.map((item) => <ProductCard key={item.id} product={item} />)}
                </div>
              </section>
            )}
            <MobilePurchaseBar product={product} />
          </>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
