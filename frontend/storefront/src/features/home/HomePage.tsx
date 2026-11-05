'use client';
import { HomeHeader } from './components/HomeHeader';
import { CategoryNav } from './components/CategoryNav';
import { HeroBannerCarousel } from './components/HeroBannerCarousel';
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
export function HomePage() {
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
        className="mx-auto max-w-7xl space-y-12 px-4 pb-14 pt-6 sm:space-y-14 sm:px-6 lg:px-8"
      >
        <HeroBannerCarousel />
        <CategoryTiles />
        <DealsOfTheDay />
        <TrustlonBrandSection />
        <FeaturedBrandStores />
        <LocalSellersStrip />
        <RecentlyViewed />
        <RecommendedForYou />
      </main>
      <TrustStrip />
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
