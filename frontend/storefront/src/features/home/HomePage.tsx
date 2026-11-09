'use client';
import { Fragment } from 'react';
import { HomeHeader } from './components/HomeHeader';
import { CategoryNav } from './components/CategoryNav';
import { ReferenceMarketplaceSections } from './components/ReferenceMarketplaceSections';
import { CategoryTiles } from './components/CategoryTiles';
import { DealsOfTheDay } from './components/DealsOfTheDay';
import { TrustlonBrandSection } from './components/TrustlonBrandSection';
import { FeaturedBrandStores } from './components/FeaturedBrandStores';
import { LocalSellersStrip } from './components/LocalSellersStrip';
import { RecentlyViewed } from './components/RecentlyViewed';
import { RecommendedForYou } from './components/RecommendedForYou';
import { TrustStrip } from './components/TrustStrip';
import { HomeFooter } from './components/HomeFooter';
import { MarketplaceDialogs } from './components/MarketplaceDialogs';
import { SectionError, SectionSkeleton } from './components/SectionStates';
import { useHome } from './home-provider';
import type { HomeSectionKey } from './types';

/** Section order and visibility come from Admin > Marketing (GET /home → sections). */
const SECTIONS: Partial<Record<HomeSectionKey, () => React.ReactNode>> = {
  HERO_BANNERS: () => <ReferenceMarketplaceSections />,
  CATEGORY_TILES: () => <CategoryTiles />,
  DEALS_OF_THE_DAY: () => <DealsOfTheDay />,
  TRUSTLON_ORIGINALS: () => <TrustlonBrandSection />,
  FEATURED_STORES: () => <FeaturedBrandStores />,
  LOCAL_SELLERS: () => <LocalSellersStrip />,
  RECENTLY_VIEWED: () => <RecentlyViewed />,
  RECOMMENDED: () => <RecommendedForYou />,
};

export function HomePage() {
  const { home, homeState, reloadHome } = useHome();
  const keys = home?.sections.map((section) => section.key) ?? [];
  return (
    <>
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-white p-3 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <HomeHeader />
      <CategoryNav />
      <main
        id="main-content"
        aria-busy={homeState === 'loading'}
        className="mx-auto max-w-7xl space-y-12 px-4 pb-14 pt-6 sm:space-y-14 sm:px-6 lg:px-8"
      >
        {homeState === 'loading' && (
          <>
            <div aria-hidden className="h-[410px] animate-pulse rounded-lg bg-slate-200" />
            <SectionSkeleton />
          </>
        )}
        {homeState === 'error' && (
          <SectionError
            message="We couldn’t load the home page. Check your connection and try again."
            onRetry={reloadHome}
          />
        )}
        {homeState === 'ready' &&
          keys.map((key) => {
            const render = SECTIONS[key];
            return render ? <Fragment key={key}>{render()}</Fragment> : null;
          })}
      </main>
      {(homeState !== 'ready' || keys.includes('TRUST_STRIP')) && <TrustStrip />}
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
