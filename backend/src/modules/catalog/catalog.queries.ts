import { Prisma, ProductStatus, VendorStatus } from '@prisma/client';

/** Only these products are ever shown on the storefront. */
export const liveProductWhere: Prisma.ProductWhereInput = {
  status: ProductStatus.LIVE,
  deletedAt: null,
  vendor: { status: VendorStatus.ACTIVE, deletedAt: null },
};

/** Only these vendors are ever shown on the storefront. */
export const activeVendorWhere: Prisma.VendorWhereInput = {
  status: VendorStatus.ACTIVE,
  deletedAt: null,
};

export const productInclude = {
  vendor: {
    select: {
      slug: true,
      displayName: true,
      isVerified: true,
      isPlatformOwned: true,
      trustScore: true,
    },
  },
  category: { select: { slug: true, name: true, nameHi: true } },
} satisfies Prisma.ProductInclude;

export type ProductRow = Prisma.ProductGetPayload<{ include: typeof productInclude }>;

/** Lower-case text the search endpoint matches against. Call whenever a product is saved. */
export function buildSearchText(parts: Array<string | null | undefined>): string {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(' ')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/** Splits a search query into lower-case terms; every term must match. */
export function searchTerms(query: string | undefined): string[] {
  return (query ?? '')
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 0)
    .slice(0, 8);
}


/** Percent off MRP at the base price. Store it in `products.discount_percent` on every save. */
export function computeDiscountPercent(pricePaise: number, mrpPaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.floor((1 - pricePaise / mrpPaise) * 100);
}