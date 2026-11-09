/** Shapes returned by the Trustlon API (backend/api). Money is always in paise. */

export interface CategoryRef {
  slug: string;
  name: string;
  nameHi: string | null;
}

export interface Category extends CategoryRef {
  image: string | null;
  children: CategoryRef[];
}

export interface Seller {
  slug: string;
  name: string;
  isVerified: boolean;
  isPlatformOwned: boolean;
  trustScore: number;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  image: string;
  category: CategoryRef;
  seller: Seller;
  currency: string;
  pricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  rating: number;
  ratingCount: number;
  badge: string | null;
  inStock: boolean;
  codAvailable: boolean;
  deal: { endsAt: string } | null;
}

export interface Banner {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta: string;
  image: string;
  mobileImage: string | null;
  href: string;
  /** Small label on the image, e.g. a featured product and price. */
  tag: string | null;
  /** Offer chips on the sale strip. */
  highlights: string[];
}

export interface Store {
  slug: string;
  name: string;
  initials: string;
  tagline: string | null;
  logo: string | null;
  image: string | null;
  trustScore: number;
  isVerified: boolean;
  isPlatformOwned: boolean;
}

export interface StoreDetail extends Store {
  description: string | null;
  productCount: number;
}

export interface LocalSeller extends Store {
  area: string | null;
  category: string | null;
  pincode: string;
  distanceKm: number;
  sameDayDelivery: boolean;
}

export type HomeSectionKey =
  | 'HERO_BANNERS'
  | 'CATEGORY_TILES'
  | 'DEALS_OF_THE_DAY'
  | 'TRUSTLON_ORIGINALS'
  | 'FEATURED_STORES'
  | 'LOCAL_SELLERS'
  | 'RECENTLY_VIEWED'
  | 'RECOMMENDED'
  | 'TRUST_STRIP';

export interface HomeData {
  sections: Array<{ key: HomeSectionKey; title: string | null; subtitle: string | null }>;
  banners: Banner[];
  promos: { strip: Banner | null; wide: Banner[]; side: Banner[] };
  categories: Category[];
  deals: { endsAt: string | null; items: Product[] };
  originals: Product[];
  trending: Product[];
  combos: Product[];
  featuredStores: Store[];
  generatedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CartLine {
  productId: string;
  slug: string;
  name: string;
  image: string;
  quantity: number;
  unitPricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  lineTotalPaise: number;
  available: boolean;
  maxQuantity: number;
}

export interface Cart {
  currency: string;
  groups: Array<{
    seller: { slug: string; name: string; isPlatformOwned: boolean; isVerified: boolean };
    items: CartLine[];
    subtotalPaise: number;
  }>;
  itemCount: number;
  subtotalPaise: number;
  savingsPaise: number;
  hasUnavailableItems: boolean;
}

export interface Suggestions {
  query: string;
  products: Array<{ id: string; slug: string; name: string; image: string }>;
  categories: Array<{ slug: string; name: string }>;
  stores: Array<{ slug: string; name: string }>;
}

export interface Serviceability {
  pincode: string;
  area: string | null;
  city: string | null;
  state: string | null;
  serviceable: boolean;
  codAvailable: boolean;
  sameDayAvailable: boolean;
  estimatedDeliveryDays: number | null;
}

export type ProductSort = 'relevance' | 'popularity' | 'price_asc' | 'price_desc' | 'newest' | 'rating';

export interface ProductQuery {
  q?: string;
  category?: string;
  store?: string;
  originals?: boolean;
  deals?: boolean;
  bundle?: boolean;
  sort?: ProductSort;
  page?: number;
  pageSize?: number;
}
