import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { activeVendorWhere, liveProductWhere } from './catalog.queries';
import { ProductsService } from './products.service';
import { ProductQueryDto } from './dto/product-query.dto';

export interface Suggestions {
  query: string;
  correctedQuery?: string;
  brands: Array<{ name: string }>;
  products: Array<{ id: string; slug: string; name: string; image: string }>;
  categories: Array<{ slug: string; name: string }>;
  stores: Array<{ slug: string; name: string }>;
}

/** Suggestions share the same matching and correction as the product results. */
@Injectable()
export class SearchService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async suggest(rawQuery: string | undefined): Promise<Suggestions> {
    const query = (rawQuery ?? '').trim();
    const result = await this.products.list(
      Object.assign(new ProductQueryDto(), {
        q: query,
        pageSize: 5,
        sort: query ? 'relevance' : 'popularity',
      }),
    );
    const effective = result.search?.query ?? query;
    const [categories, stores, brands] = effective
      ? await Promise.all([
          this.prisma.category.findMany({
            where: {
              isActive: true,
              OR: [
                { name: { contains: effective, mode: 'insensitive' } },
                { nameHi: { contains: effective, mode: 'insensitive' } },
              ],
            },
            select: { slug: true, name: true },
            orderBy: { sortOrder: 'asc' },
            take: 3,
          }),
          this.prisma.vendor.findMany({
            where: {
              ...activeVendorWhere,
              displayName: { contains: effective, mode: 'insensitive' },
            },
            select: { slug: true, displayName: true },
            orderBy: { trustScore: 'desc' },
            take: 3,
          }),
          this.prisma.product.findMany({
            where: { ...liveProductWhere, brand: { contains: effective, mode: 'insensitive' } },
            distinct: ['brand'],
            select: { brand: true },
            orderBy: { brand: 'asc' },
            take: 3,
          }),
        ])
      : [[], [], []];
    return {
      query,
      correctedQuery: result.search?.corrected ? effective : undefined,
      products: result.items.map(({ id, slug, name, image }) => ({ id, slug, name, image })),
      categories,
      stores: stores.map((store) => ({ slug: store.slug, name: store.displayName })),
      brands: brands.flatMap((product) => (product.brand ? [{ name: product.brand }] : [])),
    };
  }
}
