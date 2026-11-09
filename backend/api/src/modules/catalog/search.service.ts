import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { activeVendorWhere, liveProductWhere, searchTerms } from './catalog.queries';

export interface Suggestions {
  query: string;
  products: Array<{ id: string; slug: string; name: string; image: string }>;
  categories: Array<{ slug: string; name: string }>;
  stores: Array<{ slug: string; name: string }>;
}

/**
 * Database-backed search for v1. Replace the queries with Meilisearch or Elasticsearch
 * when the catalog grows; the response shape stays the same.
 */
@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async suggest(rawQuery: string | undefined): Promise<Suggestions> {
    const query = (rawQuery ?? '').trim();
    const terms = searchTerms(query);
    const productSelect = { id: true, slug: true, name: true, imageUrl: true } as const;

    if (terms.length === 0) {
      const popular = await this.prisma.product.findMany({
        where: liveProductWhere,
        select: productSelect,
        orderBy: [{ salesCount: 'desc' }, { ratingCount: 'desc' }],
        take: 4,
      });
      return { query, products: popular.map(toSuggestion), categories: [], stores: [] };
    }

    const [products, categories, stores] = await Promise.all([
      this.prisma.product.findMany({
        where: { AND: [liveProductWhere, ...terms.map((t) => ({ searchText: { contains: t } }))] },
        select: productSelect,
        orderBy: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }],
        take: 5,
      }),
      this.prisma.category.findMany({
        where: { isActive: true, name: { contains: query, mode: 'insensitive' } },
        select: { slug: true, name: true },
        orderBy: { sortOrder: 'asc' },
        take: 3,
      }),
      this.prisma.vendor.findMany({
        where: { ...activeVendorWhere, displayName: { contains: query, mode: 'insensitive' } },
        select: { slug: true, displayName: true },
        orderBy: { trustScore: 'desc' },
        take: 3,
      }),
    ]);

    return {
      query,
      products: products.map(toSuggestion),
      categories,
      stores: stores.map((store) => ({ slug: store.slug, name: store.displayName })),
    };
  }
}

function toSuggestion(product: { id: string; slug: string; name: string; imageUrl: string }) {
  return { id: product.id, slug: product.slug, name: product.name, image: product.imageUrl };
}
