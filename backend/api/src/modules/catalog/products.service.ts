import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Page, toPage } from '../../common/http/pagination';
import { PrismaService } from '../../prisma/prisma.service';
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
    if (query.store) and.push({ vendor: { slug: query.store } });
    if (query.originals) and.push({ vendor: { isPlatformOwned: true } });
    if (query.bundle) and.push({ isBundle: true });
    if (query.deals) and.push({ deals: { some: this.pricing.activeDealWhere() } });
    if (query.inStock) and.push({ stock: { gt: 0 } });
    if (query.minPricePaise !== undefined) and.push({ pricePaise: { gte: query.minPricePaise } });
    if (query.maxPricePaise !== undefined) and.push({ pricePaise: { lte: query.maxPricePaise } });
    for (const term of searchTerms(query.q)) and.push({ searchText: { contains: term } });

    return { AND: and };
  }
}
