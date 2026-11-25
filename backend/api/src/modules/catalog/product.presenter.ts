import { Deal } from '@prisma/client';
import { CURRENCY, discountPercent } from '../../common/utils/money';
import { ProductRow } from './catalog.queries';

export interface SellerSummary {
  slug: string;
  name: string;
  isVerified: boolean;
  isPlatformOwned: boolean;
  trustScore: number;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  image: string;
  category: { slug: string; name: string; nameHi: string | null };
  seller: SellerSummary;
  currency: string;
  /** What the customer pays now, in paise (the deal price while a deal is active). */
  pricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  rating: number;
  ratingCount: number;
  badge: string | null;
  inStock: boolean;
  codAvailable: boolean;
  deal: { endsAt: Date } | null;
}

export interface ProductDetail extends ProductSummary {
  description: string | null;
  brand: string | null;
  images: string[];
  hsnCode: string | null;
  maxQuantity: number;
}

export const MAX_QUANTITY_PER_ITEM = 10;

export function toProductSummary(product: ProductRow, deal?: Deal): ProductSummary {
  const pricePaise =
    deal && deal.dealPricePaise < product.pricePaise ? deal.dealPricePaise : product.pricePaise;
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image: product.imageUrl,
    category: product.category,
    seller: {
      slug: product.vendor.slug,
      name: product.vendor.displayName,
      isVerified: product.vendor.isVerified,
      isPlatformOwned: product.vendor.isPlatformOwned,
      trustScore: product.vendor.trustScore,
    },
    currency: CURRENCY,
    pricePaise,
    mrpPaise: product.mrpPaise,
    discountPercent: discountPercent(pricePaise, product.mrpPaise),
    rating: Math.round(product.ratingAvg * 10) / 10,
    ratingCount: product.ratingCount,
    badge: product.badge,
    inStock: product.stock > 0,
    codAvailable: product.codAllowed,
    deal: deal ? { endsAt: deal.endsAt } : null,
  };
}

export function toProductDetail(product: ProductRow, deal?: Deal): ProductDetail {
  return {
    ...toProductSummary(product, deal),
    description: product.description,
    brand: product.brand,
    images: product.images.length ? product.images : [product.imageUrl],
    hsnCode: product.hsnCode,
    maxQuantity: Math.max(0, Math.min(product.stock, MAX_QUANTITY_PER_ITEM)),
  };
}
