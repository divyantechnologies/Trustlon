import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { liveProductWhere } from '../catalog/catalog.queries';
import { ProductSummary } from '../catalog/product.presenter';
import { ProductsService } from '../catalog/products.service';

/** Wishlist belongs to the account, so it needs sign-in. Guests keep theirs in the browser. */
@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async list(userId: string): Promise<ProductSummary[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
      take: 200,
    });
    return this.products.byIds(rows.map((row) => row.productId));
  }

  async ids(userId: string): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { productId: true },
      take: 200,
    });
    return rows.map((row) => row.productId);
  }

  async add(userId: string, productId: string): Promise<{ productIds: string[] }> {
    const exists = await this.prisma.product.count({ where: { ...liveProductWhere, id: productId } });
    if (!exists) throw new NotFoundException('Product not found');

    await this.prisma.wishlistItem.upsert({
      where: { userId_productId: { userId, productId } },
      create: { userId, productId },
      update: {},
    });
    return { productIds: await this.ids(userId) };
  }

  async remove(userId: string, productId: string): Promise<{ productIds: string[] }> {
    await this.prisma.wishlistItem.deleteMany({ where: { userId, productId } });
    return { productIds: await this.ids(userId) };
  }
}
