import { productSchema, type Product } from './types';
import type { Product as CatalogProduct } from '../home/types';

/** API boundary: legacy money is paise; universal money is rupees. Invalid optional sections are omitted. */
export function adaptProduct(apiData: unknown): Product {
  if (!apiData || typeof apiData !== 'object') throw new Error('Invalid product');
  const envelope = apiData as Record<string, unknown>;
  const raw = (envelope.product ?? envelope) as Record<string, unknown>;
  if (!raw || typeof raw !== 'object') throw new Error('Invalid product');
  const c = (raw.category ?? {}) as Record<string, unknown>;
  const s = (raw.seller ?? {}) as Record<string, unknown>;
  const legacy = typeof raw.pricePaise === 'number';
  const title = raw.title ?? raw.name;
  const normalized: Record<string, unknown> = {
    ...raw,
    title,
    brand: raw.brand ?? '',
    category: {
      id: c.id ?? c.slug ?? 'general',
      name: c.name ?? 'Products',
      path: c.path ?? [c.name ?? 'Products'],
    },
    images: (Array.isArray(raw.images) && raw.images.length
      ? raw.images
      : raw.image
        ? [raw.image]
        : []
    ).map((v) => (typeof v === 'string' ? { url: v, alt: title } : v)),
    seller: { ...s, name: s.name ?? 'Seller', verified: s.verified ?? s.isVerified ?? false },
  };
  if (legacy) {
    if (raw.currency && raw.currency !== 'INR') throw new Error('Unsupported currency');
    normalized.price = {
      current: Number(raw.pricePaise) / 100,
      mrp: typeof raw.mrpPaise === 'number' ? raw.mrpPaise / 100 : undefined,
      currency: 'INR',
      taxInclusive: true,
    };
    normalized.stock = { status: raw.inStock ? 'in_stock' : 'out' };
    normalized.purchaseLimit = raw.maxQuantity;
    normalized.rating =
      Number(raw.ratingCount) > 0 ? { average: raw.rating, count: raw.ratingCount } : undefined;
    normalized.policies = raw.policies ?? { cod: raw.codAvailable };
    normalized.description =
      typeof raw.description === 'string' && raw.description.trim()
        ? { overview: raw.description }
        : undefined;
    normalized.specs = raw.specs ?? [
      {
        group: 'General',
        items: [
          { label: 'Category', value: c.name },
          { label: 'Brand', value: raw.brand },
          { label: 'HSN code', value: raw.hsnCode },
        ].filter((v) => typeof v.value === 'string' && v.value.trim()),
      },
    ];
  }
  // Validate every optional section independently so one malformed feed field cannot take down the PDP.
  let invalidPurchaseData = false;
  for (const field of [
    'video',
    'purchaseLimit',
    'rating',
    'variants',
    'skus',
    'highlights',
    'keyFeatures',
    'description',
    'specs',
    'offers',
    'policies',
    'reviews',
    'qna',
    'priceHistory',
    'related',
    'widgets',
  ] as const) {
    const parsed = productSchema.shape[field].safeParse(normalized[field]);
    if (!parsed.success && ['variants', 'skus', 'purchaseLimit'].includes(field)) {
      invalidPurchaseData = true;
    }
    normalized[field] = parsed.success ? parsed.data : undefined;
  }
  // Keep the page readable, but never turn invalid purchase constraints into an unrestricted item.
  if (invalidPurchaseData) normalized.purchaseLimit = 0;
  normalized.images = (normalized.images as unknown[]).filter(
    (v) => productSchema.shape.images.element.safeParse(v).success,
  );
  return productSchema.parse(normalized);
}

/** Bridge to the existing storefront cart/wishlist without changing its paise-based contract. */
export function toCatalogProduct(p: Product): CatalogProduct {
  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    image: p.images[0]?.url ?? '',
    category: { slug: p.category.id, name: p.category.name, nameHi: null },
    seller: {
      slug: p.seller.slug ?? '',
      name: p.seller.name,
      isVerified: p.seller.verified,
      isPlatformOwned: false,
      trustScore: 0,
    },
    currency: p.price.currency,
    pricePaise: Math.round(p.price.current * 100),
    mrpPaise: Math.round((p.price.mrp ?? p.price.current) * 100),
    discountPercent:
      p.price.mrp && p.price.mrp > p.price.current
        ? Math.round((1 - p.price.current / p.price.mrp) * 100)
        : 0,
    rating: p.rating?.average ?? 0,
    ratingCount: p.rating?.count ?? 0,
    badge: null,
    inStock: p.stock.status !== 'out' && p.stock.quantity !== 0 && p.purchaseLimit !== 0,
    codAvailable: p.policies?.cod === true,
    deal: null,
  };
}
