import { Injectable } from '@nestjs/common';
import { Shopper } from '../../common/shopper/shopper';
import { PrismaService } from '../../prisma/prisma.service';
import { liveProductWhere, productInclude, ProductRow } from '../catalog/catalog.queries';
import { ProductSummary } from '../catalog/product.presenter';
import { ProductsService } from '../catalog/products.service';
import { RecentlyViewedService } from '../shopping/recently-viewed.service';

/**
 * Rule-based recommendations for v1 (spec 2.1): popular products from the categories the
 * shopper viewed most recently, then the most popular products overall. Phase 5 replaces
 * this with a model; the endpoint stays the same.
 */
@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
    private readonly recent: RecentlyViewedService,
  ) {}

  async forShopper(shopper: Shopper | null, limit: number): Promise<ProductSummary[]> {
    const viewedIds = shopper ? await this.recent.productIds(shopper, 5) : [];
    const exclude = new Set(viewedIds);
    const picked: ProductRow[] = [];

    if (viewedIds.length) {
      const viewed = await this.prisma.product.findMany({
        where: { id: { in: viewedIds } },
        select: { id: true, categoryId: true },
      });
      const categoryOrder = viewedIds
        .map((id) => viewed.find((row) => row.id === id)?.categoryId)
        .filter((id): id is string => Boolean(id));
      const categoryIds = [...new Set(categoryOrder)];

      if (categoryIds.length) {
        const related = await this.prisma.product.findMany({
          where: {
            AND: [liveProductWhere, { categoryId: { in: categoryIds } }, { id: { notIn: [...exclude] } }],
          },
          include: productInclude,
          orderBy: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }],
          take: limit * 2,
        });
        related.sort(
          (a, b) => categoryIds.indexOf(a.categoryId) - categoryIds.indexOf(b.categoryId),
        );
        for (const row of related.slice(0, limit)) {
          picked.push(row);
          exclude.add(row.id);
        }
      }
    }

    if (picked.length < limit) {
      const popular = await this.prisma.product.findMany({
        where: { AND: [liveProductWhere, { id: { notIn: [...exclude] } }] },
        include: productInclude,
        orderBy: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }],
        take: limit - picked.length,
      });
      picked.push(...popular);
    }

    return this.products.present(picked);
  }
}
