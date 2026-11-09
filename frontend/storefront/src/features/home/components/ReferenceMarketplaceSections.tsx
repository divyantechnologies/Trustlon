'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { cn } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { homeApi } from '../api';
import { formatPrice } from '../format';
import { useHome } from '../home-provider';
import type { Banner, Category, Product } from '../types';
import { HeroBannerCarousel } from './HeroBannerCarousel';
import { Icon } from './Icon';
import { PlaceholderVisual } from './PlaceholderVisual';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';
import { ScrollSection } from './ScrollSection';

function Ad({
  banner,
  tone = 'navy',
  className = '',
  children,
}: {
  banner: Banner;
  tone?: 'navy' | 'mint' | 'yellow';
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Link
      href={banner.href}
      className={cn(
        'relative block min-h-28 overflow-hidden rounded-lg p-5',
        tone === 'navy'
          ? 'bg-navy text-white'
          : tone === 'mint'
            ? 'bg-teal-50 text-navy'
            : 'bg-cream text-navy',
        className,
      )}
    >
      {banner.image && (
        <ProductImage
          src={banner.image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}
      <div className="relative">
        {banner.eyebrow && <p className="text-xs font-semibold tracking-widest">{banner.eyebrow}</p>}
        {children}
      </div>
    </Link>
  );
}

function SaleStrip({ banner }: { banner: Banner }) {
  return (
    <Link
      href={banner.href}
      className="grid items-center gap-3 rounded-lg bg-navy p-4 text-center text-white sm:grid-cols-[auto_1fr_auto] sm:text-left"
    >
      <span className="rounded bg-red-600 px-3 py-2 text-xs font-bold">
        {banner.eyebrow ?? banner.title}
      </span>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {banner.highlights.map((chip) => {
          const [sale, code] = chip.split('·').map((part) => part.trim());
          return (
            <div key={chip} className="rounded-full border border-yellow-300 px-3 py-2 text-xs">
              <b className="text-lg text-yellow-300">{sale}</b>
              {code && (
                <span className="ml-2 text-white">
                  <b className="rounded bg-yellow-300 px-1 text-navy">{code}</b>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <span className="rounded bg-red-600 px-4 py-3 text-sm font-semibold">{banner.cta} →</span>
    </Link>
  );
}

function CategoryRail({ categories }: { categories: Category[] }) {
  const { language } = useI18n();
  return (
    <nav
      aria-label="Marketplace departments"
      className="rounded-lg border border-slate-200 bg-white p-3"
    >
      <h2 className="mb-2 px-3 py-2 font-semibold">Categories</h2>
      {categories.map((category) => (
        <Link
          key={category.slug}
          href={`/browse/${category.slug}`}
          className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-navy-50 hover:text-teal-600"
        >
          {language === 'hi' && category.nameHi ? category.nameHi : category.name}
        </Link>
      ))}
      <Link
        href="/browse/everyday"
        className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-teal-600 hover:bg-navy-50"
      >
        See more
      </Link>
    </nav>
  );
}

function TodaysView({ items }: { items: Product[] }) {
  const home = useHome();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex justify-between">
        <h2 className="font-semibold">Today’s View</h2>
        <button
          onClick={() => home.setPanel('wishlist')}
          className="flex items-center gap-1 text-xs text-teal-600"
        >
          <Icon name="heart" />
          Wishlist
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((product) => {
          const saved = home.isWishlisted(product.id);
          return (
            <article key={product.id} className="relative rounded-lg border border-slate-100 p-2">
              <button
                aria-label={`${saved ? 'Remove' : 'Save'} ${product.name} ${saved ? 'from' : 'to'} wishlist`}
                aria-pressed={saved}
                onClick={() => void home.toggleWishlist(product)}
                className={cn('absolute right-2 top-2 z-10 rounded-full bg-white p-2', saved && 'text-teal-600')}
              >
                <Icon name="heart" className={cn('h-4 w-4', saved && 'fill-current')} />
              </button>
              {product.image ? (
                <ProductImage
                  src={product.image}
                  alt={product.name}
                  className="h-24 w-full rounded-lg object-cover"
                />
              ) : (
                <PlaceholderVisual label={product.name} className="h-24 rounded-lg text-center text-xs" />
              )}
              <button
                onClick={() => home.viewProduct(product)}
                className="mt-2 line-clamp-2 min-h-10 text-left text-xs font-medium"
              >
                {product.name}
              </button>
              <p className="mt-1 font-semibold">{formatPrice(product.pricePaise)}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function DealCountdown({ endsAt }: { endsAt: string | null }) {
  const end = endsAt ? new Date(endsAt).getTime() : null;
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!end) return;
    const tick = () => setLeft(Math.max(0, Math.floor((end - Date.now()) / 1000)));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [end]);
  if (left === null) return null;
  return (
    <p className="mb-3 text-xs text-slate-500">
      {left === 0
        ? 'Offer ended'
        : `Ends in ${String(Math.floor(left / 3600)).padStart(2, '0')}:${String(
            Math.floor(left / 60) % 60,
          ).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`}
    </p>
  );
}

function DealPanel({ items, endsAt }: { items: Product[]; endsAt: string | null }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-xl font-semibold">Deal Of The Day</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">Score big savings while these deals last</p>
      <DealCountdown endsAt={endsAt} />
      <div className="grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto sm:auto-cols-[48%] lg:auto-cols-[100%]">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}

/** Most popular products per top category, loaded per tab from GET /products. */
function Top100({ categories, ad }: { categories: Category[]; ad?: Banner }) {
  const { language } = useI18n();
  const tabs = categories.slice(0, 4);
  const [tab, setTab] = useState(tabs[0]?.slug ?? '');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<Product[] | null>(null);
  useEffect(() => {
    if (!tab) return;
    const controller = new AbortController();
    setItems(null);
    homeApi
      .products({ category: tab, sort: 'popularity', pageSize: 10 }, controller.signal)
      .then((page) => setItems(page.items))
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, [tab]);
  const list = items ?? [];
  const rotated = list.length ? [...list.slice(offset), ...list.slice(0, offset)] : [];
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Top 100</h2>
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((category) => (
            <button
              key={category.slug}
              onClick={() => {
                setTab(category.slug);
                setOffset(0);
              }}
              className={cn(
                'min-h-10 whitespace-nowrap rounded-lg px-3 text-xs',
                tab === category.slug ? 'bg-navy text-white' : 'hover:bg-navy-50',
              )}
            >
              {language === 'hi' && category.nameHi ? category.nameHi : category.name}
            </button>
          ))}
        </div>
      </div>
      {items === null ? (
        <div aria-hidden className="mt-4 grid animate-pulse grid-cols-2 gap-3">
          <div className="h-72 rounded-lg bg-slate-100" />
          <div className="h-72 rounded-lg bg-slate-100" />
        </div>
      ) : rotated.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">No products in this category yet.</p>
      ) : (
        <div className="mt-4 grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto sm:auto-cols-[45%] lg:auto-cols-[48%]">
          {rotated.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
      {list.length > 1 && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            aria-label="Previous Top 100 products"
            onClick={() => setOffset((offset + list.length - 1) % list.length)}
            className="rounded-lg border px-3 py-2"
          >
            ‹
          </button>
          <button
            aria-label="Next Top 100 products"
            onClick={() => setOffset((offset + 1) % list.length)}
            className="rounded-lg border px-3 py-2"
          >
            ›
          </button>
        </div>
      )}
      {ad && (
        <Ad banner={ad} tone="mint" className="mt-4">
          <h3 className="text-xl font-bold">{ad.title}</h3>
          {ad.subtitle && <p className="mt-1 text-sm">{ad.subtitle}</p>}
        </Ad>
      )}
    </section>
  );
}

function Confidence({ categories }: { categories: Category[] }) {
  const { language } = useI18n();
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-5 text-xl font-semibold">Shop with complete confidence</h2>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {categories.map((category) => {
          const name = language === 'hi' && category.nameHi ? category.nameHi : category.name;
          return (
            <Link key={category.slug} href={`/browse/${category.slug}`} className="text-center">
              {category.image ? (
                <ProductImage
                  src={category.image}
                  alt=""
                  className="mx-auto h-16 w-16 rounded-lg object-cover"
                />
              ) : (
                <PlaceholderVisual label={name} className="mx-auto h-16 w-16 rounded-lg text-[10px]" />
              )}
              <p className="mt-2 text-xs">{name}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

function ComboSection({ items }: { items: Product[] }) {
  return (
    <section className="min-w-0">
      <ScrollSection title="Combo Products" href="/browse/combos">
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </ScrollSection>
    </section>
  );
}

/** Marketplace layout above the regular home sections. Every block reads from GET /home. */
export function ReferenceMarketplaceSections() {
  const { home } = useHome();
  if (!home) return null;
  const { promos, categories, trending, deals, combos } = home;
  const [wideTop, wideTop100] = promos.wide;
  const [sideFirst, sideSecond] = promos.side;
  return (
    <div className="space-y-6">
      {promos.strip && promos.strip.highlights.length > 0 && <SaleStrip banner={promos.strip} />}
      <div className="grid gap-4 lg:grid-cols-[19%_60%_21%]">
        <CategoryRail categories={categories} />
        <HeroBannerCarousel />
        {trending.length > 0 && <TodaysView items={trending.slice(0, 4)} />}
      </div>
      {wideTop && (
        <Ad
          banner={wideTop}
          tone="mint"
          className="flex min-h-36 items-center justify-center text-center"
        >
          <h2 className="text-2xl font-bold uppercase">{wideTop.title}</h2>
          {wideTop.subtitle && <p className="text-xl font-semibold uppercase">{wideTop.subtitle}</p>}
        </Ad>
      )}
      <div className="grid gap-4 lg:grid-cols-[40%_60%]">
        {deals.items.length > 0 && <DealPanel items={deals.items.slice(0, 3)} endsAt={deals.endsAt} />}
        <Top100 categories={categories} ad={wideTop100} />
      </div>
      {combos.length > 0 && (
        <div className="grid gap-5 lg:grid-cols-[75%_25%]">
          <ComboSection items={combos} />
          <aside className="space-y-4">
            {sideFirst && (
              <Ad banner={sideFirst} tone="mint">
                <h2 className="text-2xl font-bold">{sideFirst.title}</h2>
                {sideFirst.subtitle && <p className="mt-1 text-sm">{sideFirst.subtitle}</p>}
              </Ad>
            )}
            {sideSecond && (
              <Ad banner={sideSecond} tone="yellow">
                <h2 className="text-3xl font-bold">{sideSecond.title}</h2>
                {sideSecond.subtitle && <p>{sideSecond.subtitle}</p>}
              </Ad>
            )}
            <h2 className="text-center font-semibold">Shopping Tweet</h2>
            <ProductImage
              src="/images/home/hero.jpg"
              alt="Shopping Tweet promotional image"
              className="h-28 w-full rounded-lg object-cover"
            />
          </aside>
        </div>
      )}
      <Confidence categories={categories} />
    </div>
  );
}
