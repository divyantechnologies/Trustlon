import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Page, toPage } from '../../common/http/pagination';
import { boundingBox, distanceKm } from '../../common/utils/geo';
import { PrismaService } from '../../prisma/prisma.service';
import { PincodeService } from '../location/pincode.service';
import { CategoriesService } from './categories.service';
import { liveProductWhere, productInclude, ProductRow, searchTerms } from './catalog.queries';
import { ProductQueryDto, ProductSort } from './dto/product-query.dto';
import { PricingService } from './pricing.service';
import {
  ProductDetail,
  ProductSummary,
  toProductDetail,
  toProductSummary,
} from './product.presenter';

const ORDER_BY: Record<ProductSort, Prisma.ProductOrderByWithRelationInput[]> = {
  relevance: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }, { createdAt: 'desc' }],
  popularity: [{ salesCount: 'desc' }, { ratingCount: 'desc' }],
  price_asc: [{ pricePaise: 'asc' }, { id: 'asc' }],
  price_desc: [{ pricePaise: 'desc' }, { id: 'asc' }],
  newest: [{ createdAt: 'desc' }],
  rating: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }],
};

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly pricing: PricingService,
    private readonly pincodes: PincodeService,
  ) {}

  async list(query: ProductQueryDto): Promise<Page<ProductSummary>> {
    const where = await this.buildWhere(query);
    if (!where) return toPage([], 0, query.page, query.pageSize);

    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: ORDER_BY[query.sort],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return toPage(await this.present(rows), total, query.page, query.pageSize);
  }

  async detail(slug: string): Promise<{ product: ProductDetail; similar: ProductSummary[] }> {
    const product = await this.prisma.product.findFirst({
      where: { ...liveProductWhere, slug },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found');

    const similarRows = await this.prisma.product.findMany({
      where: { ...liveProductWhere, categoryId: product.categoryId, id: { not: product.id } },
      include: productInclude,
      orderBy: ORDER_BY.popularity,
      take: 8,
    });
    const deals = await this.pricing.activeDeals([product.id, ...similarRows.map((r) => r.id)]);

    return {
      product: toProductDetail(product, deals.get(product.id)),
      similar: similarRows.map((row) => toProductSummary(row, deals.get(row.id))),
    };
  }

  /** Live products by id, in the order given. Unknown or hidden ids are skipped. */
  async byIds(ids: string[]): Promise<ProductSummary[]> {
    if (ids.length === 0) return [];
    const rows = await this.prisma.product.findMany({
      where: { ...liveProductWhere, id: { in: ids } },
      include: productInclude,
    });
    const presented = new Map((await this.present(rows)).map((p) => [p.id, p]));
    return ids.map((id) => presented.get(id)).filter((p): p is ProductSummary => Boolean(p));
  }

  /** Adds active deal prices to product rows. */
  async present(rows: ProductRow[]): Promise<ProductSummary[]> {
    const deals = await this.pricing.activeDeals(rows.map((row) => row.id));
    return rows.map((row) => toProductSummary(row, deals.get(row.id)));
  }

  /** Null means a filter points at something that does not exist, so the result is empty. */
  private async buildWhere(query: ProductQueryDto): Promise<Prisma.ProductWhereInput | null> {
    const and: Prisma.ProductWhereInput[] = [liveProductWhere];

    if (query.category) {
      const ids = await this.categories.idsWithChildren(query.category);
      if (!ids) return null;
      and.push({ categoryId: { in: ids } });
    }
    if (query.store?.length) and.push({ vendor: { slug: { in: query.store } } });
    if (query.brand?.length) and.push({ brand: { in: query.brand } });
    if (query.minRating !== undefined) and.push({ ratingAvg: { gte: query.minRating } });
    if (query.minDiscount !== undefined) and.push({ discountPercent: { gte: query.minDiscount } });
    if (query.verified) and.push({ vendor: { isVerified: true } });
    if (query.cod) and.push({ codAllowed: true });
    if (query.nearPincode) {
      const vendorIds = await this.localVendorIds(query.nearPincode, query.radiusKm);
      if (vendorIds.length === 0) return null;
      and.push({ vendorId: { in: vendorIds } });
    }
    if (query.originals) and.push({ vendor: { isPlatformOwned: true } });
    if (query.bundle) and.push({ isBundle: true });
    if (query.deals) and.push({ deals: { some: this.pricing.activeDealWhere() } });
    if (query.inStock) and.push({ stock: { gt: 0 } });
    if (query.minPricePaise !== undefined) and.push({ pricePaise: { gte: query.minPricePaise } });
    if (query.maxPricePaise !== undefined) and.push({ pricePaise: { lte: query.maxPricePaise } });
    for (const term of searchTerms(query.q)) and.push({ searchText: { contains: term } });

    return { AND: and };
  }

  /**
   * Filter options for a listing page. Counts cover the page's scope (category, search and
   * collection flags) without the shopper's own filter choices, so every option stays visible.
   */
  async facets(query: ProductQueryDto): Promise<ProductFacets> {
    const scopeQuery = {
      q: query.q,
      category: query.category,
      originals: query.originals,
      bundle: query.bundle,
      deals: query.deals,
    } as ProductQueryDto;
    const scope = await this.buildWhere(scopeQuery);
    if (!scope) return emptyFacets();

    const within = (extra: Prisma.ProductWhereInput): Prisma.ProductWhereInput => ({
      AND: [scope, extra],
    });

    const [total, price, brandRows, vendorRows] = await Promise.all([
      this.prisma.product.count({ where: scope }),
      this.prisma.product.aggregate({ where: scope, _min: { pricePaise: true }, _max: { pricePaise: true } }),
      this.prisma.product.groupBy({
        by: ['brand'],
        where: within({ brand: { not: null } }),
        _count: { _all: true },
        orderBy: { _count: { brand: 'desc' } },
        take: 30,
      }),
      this.prisma.product.groupBy({
        by: ['vendorId'],
        where: scope,
        _count: { _all: true },
        orderBy: { _count: { vendorId: 'desc' } },
        take: 30,
      }),
    ]);

    const vendors = await this.prisma.vendor.findMany({
      where: { id: { in: vendorRows.map((row) => row.vendorId) } },
      select: { id: true, slug: true, displayName: true, isVerified: true, isPlatformOwned: true },
    });
    const vendorById = new Map<
      string,
      { slug: string; displayName: string; isVerified: boolean; isPlatformOwned: boolean }
    >(vendors.map((vendor) => [vendor.id, vendor]));

    const countWhere = (extra: Prisma.ProductWhereInput) => this.prisma.product.count({ where: within(extra) });
    const [ratingCounts, discountCounts, inStock, verified, cod, deals] = await Promise.all([
      Promise.all(RATING_STEPS.map((min) => countWhere({ ratingAvg: { gte: min } }))),
      Promise.all(DISCOUNT_STEPS.map((min) => countWhere({ discountPercent: { gte: min } }))),
      countWhere({ stock: { gt: 0 } }),
      countWhere({ vendor: { isVerified: true } }),
      countWhere({ codAllowed: true }),
      countWhere({ deals: { some: this.pricing.activeDealWhere() } }),
    ]);

    return {
      total,
      priceRange: { minPaise: price._min.pricePaise ?? 0, maxPaise: price._max.pricePaise ?? 0 },
      brands: brandRows
        .filter((row): row is typeof row & { brand: string } => row.brand !== null)
        .map((row) => ({ name: row.brand, count: row._count._all })),
      stores: vendorRows
        .map((row) => {
          const vendor = vendorById.get(row.vendorId);
          return vendor
            ? {
                slug: vendor.slug,
                name: vendor.displayName,
                isVerified: vendor.isVerified,
                isPlatformOwned: vendor.isPlatformOwned,
                count: row._count._all,
              }
            : null;
        })
        .filter((store): store is NonNullable<typeof store> => store !== null),
      ratings: RATING_STEPS.map((min, index) => ({ min, count: ratingCounts[index] })).filter((r) => r.count > 0),
      discounts: DISCOUNT_STEPS.map((min, index) => ({ min, count: discountCounts[index] })).filter(
        (d) => d.count > 0,
      ),
      counts: { inStock, verified, cod, deals },
    };
  }

  /** Same-day sellers whose pickup pincode is within the radius of the shopper's pincode. */
  private async localVendorIds(pincode: string, radiusKm: number): Promise<string[]> {
    const origin = await this.pincodes.find(pincode);
    if (!origin || origin.latitude === null || origin.longitude === null) return [];
    const box = boundingBox(origin.latitude, origin.longitude, radiusKm);
    const vendors = await this.prisma.vendor.findMany({
      where: {
        sameDayDelivery: true,
        pickup: {
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
        },
      },
      select: { id: true, pickup: { select: { latitude: true, longitude: true } } },
      take: 500,
    });
    return vendors
      .filter(
        (vendor) =>
          vendor.pickup?.latitude != null &&
          vendor.pickup.longitude != null &&
          distanceKm(origin.latitude!, origin.longitude!, vendor.pickup.latitude, vendor.pickup.longitude) <=
            radiusKm,
      )
      .map((vendor) => vendor.id);
  }
}

const RATING_STEPS = [4, 3, 2] as const;
const DISCOUNT_STEPS = [10, 20, 30, 40, 50] as const;

export interface ProductFacets {
  total: number;
  priceRange: { minPaise: number; maxPaise: number };
  brands: Array<{ name: string; count: number }>;
  stores: Array<{ slug: string; name: string; isVerified: boolean; isPlatformOwned: boolean; count: number }>;
  ratings: Array<{ min: number; count: number }>;
  discounts: Array<{ min: number; count: number }>;
  counts: { inStock: number; verified: number; cod: number; deals: number };
}

function emptyFacets(): ProductFacets {
  return {
    total: 0,
    priceRange: { minPaise: 0, maxPaise: 0 },
    brands: [],
    stores: [],
    ratings: [],
    discounts: [],
    counts: { inStock: 0, verified: 0, cod: 0, deals: 0 },
  };
}