import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ownerWhere, Shopper } from '../../common/shopper/shopper';
import { PrismaService } from '../../prisma/prisma.service';
import { liveProductWhere } from '../catalog/catalog.queries';
import { ProductSummary } from '../catalog/product.presenter';
import { ProductsService } from '../catalog/products.service';

const KEEP_PER_SHOPPER = 20;

@Injectable()
export class RecentlyViewedService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async record(shopper: Shopper, productId: string): Promise<void> {
    const exists = await this.prisma.product.count({ where: { ...liveProductWhere, id: productId } });
    if (!exists) throw new NotFoundException('Product not found');

    const owner = ownerWhere(shopper);
    const now = new Date();
    const updated = await this.prisma.recentlyViewed.updateMany({
      where: { ...owner, productId },
      data: { viewedAt: now },
    });
    if (updated.count === 0) {
      try {
        await this.prisma.recentlyViewed.create({ data: { ...owner, productId, viewedAt: now } });
      } catch (error) {
        const duplicate =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
        if (!duplicate) throw error;
      }
    }
    await this.trim(owner);
  }

  async productIds(shopper: Shopper, limit = 10): Promise<string[]> {
    const rows = await this.prisma.recentlyViewed.findMany({
      where: ownerWhere(shopper),
      orderBy: { viewedAt: 'desc' },
      select: { productId: true },
      take: limit,
    });
    return rows.map((row) => row.productId);
  }

  async list(shopper: Shopper, limit = 10): Promise<ProductSummary[]> {
    return this.products.byIds(await this.productIds(shopper, limit));
  }

  async clear(shopper: Shopper): Promise<void> {
    await this.prisma.recentlyViewed.deleteMany({ where: ownerWhere(shopper) });
  }

  /** Moves a guest's history to the user after sign-in, keeping the latest view of each product. */
  async mergeGuest(guestToken: string, userId: string): Promise<void> {
    const guestRows = await this.prisma.recentlyViewed.findMany({ where: { guestToken } });
    for (const row of guestRows) {
      const existing = await this.prisma.recentlyViewed.findFirst({
        where: { userId, productId: row.productId },
      });
      if (existing) {
        if (existing.viewedAt < row.viewedAt) {
          await this.prisma.recentlyViewed.update({
            where: { id: existing.id },
            data: { viewedAt: row.viewedAt },
          });
        }
        await this.prisma.recentlyViewed.delete({ where: { id: row.id } });
      } else {
        await this.prisma.recentlyViewed.update({
          where: { id: row.id },
          data: { guestToken: null, userId },
        });
      }
    }
    await this.trim({ userId });
  }

  private async trim(owner: { userId: string } | { guestToken: string }): Promise<void> {
    const stale = await this.prisma.recentlyViewed.findMany({
      where: owner,
      orderBy: { viewedAt: 'desc' },
      skip: KEEP_PER_SHOPPER,
      select: { id: true },
    });
    if (stale.length) {
      await this.prisma.recentlyViewed.deleteMany({ where: { id: { in: stale.map((r) => r.id) } } });
    }
  }
}
