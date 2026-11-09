'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Button, cn, focusRing } from '@/design-system';
import { ScrollSection } from './ScrollSection';
import { ProductCard } from './ProductCard';
import { ProductImage } from './ProductImage';
import { HeroBannerCarousel } from './HeroBannerCarousel';
import { PlaceholderVisual } from './PlaceholderVisual';
import { Icon } from './Icon';
import { useHome } from '../home-provider';
import {
  referenceProducts as p,
  dealProducts,
  topProducts,
  comboProducts,
  topCategories,
} from '../data/reference-marketplace';
function Ad({
  title,
  children,
  image,
  tone = 'navy',
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  image?: string;
  tone?: 'navy' | 'mint' | 'yellow';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative min-h-28 overflow-hidden rounded-lg p-5',
        tone === 'navy'
          ? 'bg-navy text-white'
          : tone === 'mint'
            ? 'bg-teal-50 text-navy'
            : 'bg-cream text-navy',
        className,
      )}
    >
      {image && (
        <ProductImage
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-25"
        />
      )}
      <div className="relative">
        {title && <p className="text-xs font-semibold tracking-widest">{title}</p>}
        {children}
      </div>
    </div>
  );
}
function SaleStrip() {
  const offers = [70, 50, 30, 10];
  return (
    <Link
      href="/browse/deals"
      className="grid items-center gap-3 rounded-lg bg-navy p-4 text-center text-white sm:grid-cols-[auto_1fr_auto] sm:text-left"
    >
      <span className="rounded bg-red-600 px-3 py-2 text-xs font-bold">SUPER SEPTEMBER</span>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {offers.map((n) => (
          <div key={n} className="rounded-full border border-yellow-300 px-3 py-2 text-xs">
            <b className="text-lg text-yellow-300">SALE {n}%</b>
            <span className="ml-2 text-white">
              CODE <b className="rounded bg-yellow-300 px-1 text-navy">HP NY{n}</b>
            </span>
          </div>
        ))}
      </div>
      <span className="rounded bg-red-600 px-4 py-3 text-sm font-semibold">Explore now ?</span>
    </Link>
  );
}
function CategoryRail() {
  const labels = [
    'Baby & Kids',
    'Digital',
    'Digital & Electronics',
    'Fashion',
    'Fashion & Accessories',
    'Food & Restaurant',
    'Health Care',
    'Home & Living',
    'Spa & Massage',
    'Sport & Entertainment',
    'See More',
  ];
  return (
    <nav
      aria-label="Marketplace departments"
      className="rounded-lg border border-slate-200 bg-white p-3"
    >
      <h2 className="mb-2 px-3 py-2 font-semibold">Categories</h2>
      {labels.map((x) => (
        <Link
          key={x}
          href={`/browse/${encodeURIComponent(x.toLowerCase().replaceAll(' ', '-'))}`}
          className="flex min-h-10 items-center rounded-lg px-3 text-sm hover:bg-navy-50 hover:text-teal-600"
        >
          {x}
        </Link>
      ))}
    </nav>
  );
}
function TodaysView() {
  const home = useHome();
  const items = [p.watch, p.vr, p.monitor, p.buds];
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex justify-between">
        <h2 className="font-semibold">Today?s View</h2>
        <button
          onClick={() => home.setPanel('wishlist')}
          className="flex items-center gap-1 text-xs text-teal-600"
        >
          <Icon name="heart" />
          Wishlist
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {items.map((x) => (
          <article key={x.id} className="relative rounded-lg border border-slate-100 p-2">
            <button
              aria-label={`Save ${x.name} to wishlist`}
              onClick={() => home.toggleWishlist(x.id)}
              className="absolute right-2 top-2 z-10 rounded-full bg-white p-2"
            >
              <Icon name="heart" className="h-4 w-4" />
            </button>
            {x.image ? (
              <ProductImage
                src={x.image}
                alt={x.name}
                className="h-24 w-full rounded-lg object-cover"
              />
            ) : (
              <PlaceholderVisual label={x.name} className="h-24 rounded-lg text-center text-xs" />
            )}
            <button
              onClick={() => home.viewProduct(x.id)}
              className="mt-2 line-clamp-2 min-h-10 text-left text-xs font-medium"
            >
              {x.name}
            </button>
            <p className="mt-1 font-semibold">{x.priceText}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
function MainCampaign() {
  return <HeroBannerCarousel />;
}
function CyberBanner() {
  return (
    <Ad
      title="CYBER MONDAY"
      tone="mint"
      image="/images/home/audio.jpg"
      className="flex min-h-36 items-center justify-center text-center"
    >
      <h2 className="text-2xl font-bold">BRAND WEEK SALE</h2>
      <p className="text-xl font-semibold">UP TO 75% OFF!</p>
    </Ad>
  );
}
function DealPanel() {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="text-xl font-semibold">Deal Of The Day</h2>
      <p className="mb-4 mt-1 text-sm text-slate-500">Score up to 80% OFF while these deals last</p>
      <DealCountdown />
      <div className="grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto sm:auto-cols-[48%] lg:auto-cols-[100%]">
        {dealProducts.map((x) => (
          <ProductCard key={x.id} product={x} />
        ))}
      </div>
    </section>
  );
}
function DealCountdown() {
  const [n, setN] = useState(3600);
  useEffect(() => {
    const id = window.setInterval(() => setN((x) => Math.max(0, x - 1)), 1000);
    return () => window.clearInterval(id);
  }, []);
  return (
    <p className="mb-3 text-xs text-slate-500">
      ? {String(Math.floor(n / 3600)).padStart(2, '0')}:
      {String(Math.floor(n / 60) % 60).padStart(2, '0')}:{String(n % 60).padStart(2, '0')}
    </p>
  );
}
function Top100() {
  const [tab, setTab] = useState(topCategories[0]);
  const [offset, setOffset] = useState(0);
  const filtered =
    tab === topCategories[0]
      ? topProducts
      : tab === topCategories[1]
        ? [p.yoga, p.bag]
        : tab === topCategories[2]
          ? [p.bag]
          : [p.vr, p.yoga];
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Top 100</h2>
        <div className="flex gap-1 overflow-x-auto">
          {topCategories.map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setOffset(0);
              }}
              className={cn(
                'min-h-10 whitespace-nowrap rounded-lg px-3 text-xs',
                tab === t ? 'bg-navy text-white' : 'hover:bg-navy-50',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 grid grid-flow-col auto-cols-[78%] gap-3 overflow-x-auto sm:auto-cols-[45%] lg:auto-cols-[48%]">
        {[...filtered.slice(offset), ...filtered.slice(0, offset)].map((x) => (
          <ProductCard key={x.id} product={x} />
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          aria-label="Previous Top 100 products"
          onClick={() => setOffset((offset + filtered.length - 1) % filtered.length)}
          className="rounded-lg border px-3 py-2"
        >
          ?
        </button>
        <button
          aria-label="Next Top 100 products"
          onClick={() => setOffset((offset + 1) % filtered.length)}
          className="rounded-lg border px-3 py-2"
        >
          ?
        </button>
      </div>
      <Ad
        title="OFFICIAL LAUNCH SPECIAL"
        tone="mint"
        image="/images/home/chair.jpg"
        className="mt-4"
      >
        <h3 className="text-xl font-bold">30% off from retail</h3>
        <PlaceholderVisual label="Sofa" className="mt-3 h-16 rounded-lg" />
      </Ad>
    </section>
  );
}
function Confidence() {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="mb-5 text-xl font-semibold">Shop with complete confidence</h2>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-8">
        {[
          ['Fashion', 'sneakers.jpg'],
          ['Beauty', 'skincare.jpg'],
          ['Stationery', ''],
          ['Shopping', ''],
          ['Motorcycles', ''],
          ['Travel', 'backpack.jpg'],
          ['Home appliances', 'lamp.jpg'],
          ['Gaming', ''],
        ].map(([name, img]) => (
          <div key={name} className="text-center">
            {img ? (
              <ProductImage
                src={`/images/home/${img}`}
                alt=""
                className="mx-auto h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <PlaceholderVisual
                label={name}
                className="mx-auto h-16 w-16 rounded-lg text-[10px]"
              />
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
function ComboSection() {
  return (
    <section className="min-w-0">
      <ScrollSection title="Combo Products" href="/browse/combos">
        {comboProducts.map((x) => (
          <ProductCard key={x.id} product={x} />
        ))}
      </ScrollSection>
    </section>
  );
}
export function ReferenceMarketplaceSections() {
  return (
    <div className="space-y-6">
      <SaleStrip />
      <div className="grid gap-4 lg:grid-cols-[19%_60%_21%]">
        <CategoryRail />
        <MainCampaign />
        <TodaysView />
      </div>
      <CyberBanner />
      <div className="grid gap-4 lg:grid-cols-[40%_60%]">
        <DealPanel />
        <Top100 />
      </div>
      <div className="grid gap-5 lg:grid-cols-[75%_25%]">
        <ComboSection />
        <aside className="space-y-4">
          <Ad title="Beauty Health" tone="mint" image="/images/home/skincare.jpg">
            <h2 className="text-2xl font-bold">#Women Care</h2>
          </Ad>
          <Ad title="SPECIAL OFFER" tone="yellow">
            <h2 className="text-3xl font-bold">SUMMER</h2>
            <p>UP TO 80% OFF</p>
            <p>Buy 1 Get 1</p>
          </Ad>
          <h2 className="text-center font-semibold">Shopping Tweet</h2>
          <ProductImage
            src="/images/home/hero.jpg"
            alt="Shopping Tweet promotional image"
            className="h-28 w-full rounded-lg object-cover"
          />
        </aside>
      </div>
      <Confidence />
    </div>
  );
}
