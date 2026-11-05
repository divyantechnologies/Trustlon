'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { Alert, typography } from '@/design-system';
import { products, dealIds } from './data/products';
import { getRecommendations } from './data/recommendations';
import { useHome } from './home-provider';
import { FeaturedBrandStores } from './components/FeaturedBrandStores';
import { LocalSellersStrip } from './components/LocalSellersStrip';
import { categories } from './data/categories';
import { stores } from './data/stores';
import { sellers } from './data/sellers';
import { HomeHeader } from './components/HomeHeader';
import { CategoryNav } from './components/CategoryNav';
import { HomeFooter } from './components/HomeFooter';
import { ProductCard } from './components/ProductCard';
import { MarketplaceDialogs } from './components/MarketplaceDialogs';
const informational: Record<string, string> = {
  account: 'Your account',
  orders: 'Your orders',
  help: 'Help centre',
  about: 'About Trustlon',
  story: 'Our story',
  careers: 'Careers at Trustlon',
  sell: 'Sell on Trustlon',
  returns: 'Returns & refunds',
  contact: 'Contact Trustlon',
  privacy: 'Privacy policy',
  terms: 'Terms of use',
  shipping: 'Shipping policy',
  protection: 'Buyer protection',
  instagram: 'Trustlon on Instagram',
  facebook: 'Trustlon on Facebook',
  youtube: 'Trustlon on YouTube',
  app: 'The Trustlon app',
};
export function BrowsePage() {
  const { slug } = useParams<{ slug: string }>();
  const params = useSearchParams();
  const { recent } = useHome();
  const query = params.get('q') ?? '';
  const category = categories.find((item) => item.id === slug);
  const store = stores.find((item) => item.id === slug);
  const seller = sellers.find((item) => item.id === slug);
  const title =
    informational[slug] ??
    category?.name ??
    store?.name ??
    seller?.name ??
    {
      search: 'Search results',
      deals: 'Today’s deals',
      originals: 'Trustlon Originals',
      stores: 'Verified brand stores',
      local: 'Neighbourhood favourites',
      recommended: 'Picked for you',
      everyday: 'The everyday collection',
    }[slug] ??
    'Explore Trustlon';
  const collection = slug === 'recommended' ? getRecommendations(recent) : products;
  const filtered = collection.filter((product) => {
    if (slug === 'deals') return dealIds.includes(product.id);
    if (slug === 'search')
      return `${product.name} ${product.seller} ${product.category}`
        .toLowerCase()
        .includes(query.toLowerCase());
    if (slug === 'originals') return product.isPlatformOwned;
    if (category) return product.category === category.id;
    if (store) return product.seller === store.name;
    if (seller) return product.category === (slug === 'living-room' ? 'home' : 'grocery');
    return true;
  });
  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <Link href="/" className="mb-6 inline-flex min-h-11 items-center text-teal-600">
          ← Back to home
        </Link>
        <h1 className={typography.pageTitle}>{title}</h1>
        <p className="mb-8 mt-3 text-slate-500">
          {slug === 'search'
            ? `Mock results for “${query || 'all products'}”`
            : 'A preview of what’s next at Trustlon.'}
        </p>
        {informational[slug] ? (
          <div className="max-w-xl space-y-5">
            <Alert tone="info">
              This is a frontend preview. This service is not connected yet.
            </Alert>
            <p className="leading-7 text-slate-500">
              {slug === 'app'
                ? 'Our mobile app is coming soon. For now, explore the marketplace right here.'
                : slug === 'orders'
                  ? 'Your demo cart does not create real orders. Order tracking will be available when this service launches.'
                  : 'This destination is reserved for future content. No forms, account actions, or external services are connected in this demo.'}
            </p>
          </div>
        ) : (
          <>
            {params.get('section') && (
              <p className="mb-5 text-slate-500">
                {params.get('section')} · Showing sample {category?.name ?? 'catalog'} items.
              </p>
            )}
            <div className="mb-6">
              <Alert tone="info">
                Illustrative catalog only. Prices, ratings, seller verification, and delivery labels
                are mock data.
              </Alert>
            </div>
            {slug === 'stores' ? (
              <FeaturedBrandStores showViewAll={false} />
            ) : slug === 'local' ? (
              <LocalSellersStrip showViewAll={false} />
            ) : filtered.length ? (
              <div className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-slate-500">
                No matching products. Try a different search.
              </p>
            )}
          </>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
