import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PriceAlertStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ProductSummary } from '../catalog/product.presenter';
import { ProductsService } from '../catalog/products.service';

export const MAX_PRICE_ALERTS = 50;
/** Smallest drop worth alerting on: 1% below today's price. */
const MIN_DROP_RATIO = 0.99;

export interface PriceAlertView {
  id: string;
  status: PriceAlertStatus;
  targetPricePaise: number;
  priceAtCreationPaise: number;
  createdAt: Date;
  /** Null when the product is no longer sold. */
  product: ProductSummary | null;
  /** True when today's price is at or below the target. */
  reached: boolean;
}

@Injectable()
export class PriceAlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly products: ProductsService,
  ) {}

  async list(userId: string): Promise<PriceAlertView[]> {
    const rows = await this.prisma.priceAlert.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: MAX_PRICE_ALERTS,
    });
    const products = new Map(
      (await this.products.byIds(rows.map((row) => row.productId))).map((p) => [p.id, p]),
    );
    return rows.map((row) => {
      const product = products.get(row.productId) ?? null;
      return {
        id: row.id,
        status: row.status,
        targetPricePaise: row.targetPricePaise,
        priceAtCreationPaise: row.priceAtCreationPaise,
        createdAt: row.createdAt,
        product,
        reached: Boolean(product && product.pricePaise <= row.targetPricePaise),
      };
    });
  }

  /** Creates the alert, or updates the target if the customer already watches this product. */
  async upsert(
    userId: string,
    productId: string,
    targetPricePaise: number,
  ): Promise<PriceAlertView[]> {
    const [product] = await this.products.byIds([productId]);
    if (!product) throw new NotFoundException('Product not found');
    this.assertTarget(targetPricePaise, product.pricePaise);

    const existing = await this.prisma.priceAlert.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (existing) {
      await this.prisma.priceAlert.update({
        where: { id: existing.id },
        data: {
          targetPricePaise,
          priceAtCreationPaise: product.pricePaise,
          status: PriceAlertStatus.ACTIVE,
          lastNotifiedAt: null,
        },
      });
    } else {
      const count = await this.prisma.priceAlert.count({ where: { userId } });
      if (count >= MAX_PRICE_ALERTS) {
        throw new ConflictException(
          `You can watch up to ${MAX_PRICE_ALERTS} products. Remove an alert to add another.`,
        );
      }
      await this.prisma.priceAlert.create({
        data: { userId, productId, targetPricePaise, priceAtCreationPaise: product.pricePaise },
      });
    }
    return this.list(userId);
  }

  async update(
    userId: string,
    id: string,
    changes: { targetPricePaise?: number; status?: PriceAlertStatus },
  ): Promise<PriceAlertView[]> {
    const alert = await this.prisma.priceAlert.findFirst({ where: { id, userId } });
    if (!alert) throw new NotFoundException('Price alert not found');

    if (changes.targetPricePaise !== undefined) {
      const [product] = await this.products.byIds([alert.productId]);
      if (!product) throw new ConflictException('This product is no longer sold');
      this.assertTarget(changes.targetPricePaise, product.pricePaise);
    }
    await this.prisma.priceAlert.update({
      where: { id },
      data: {
        ...(changes.targetPricePaise !== undefined
          ? { targetPricePaise: changes.targetPricePaise, lastNotifiedAt: null }
          : {}),
        ...(changes.status ? { status: changes.status } : {}),
      },
    });
    return this.list(userId);
  }

  async remove(userId: string, id: string): Promise<PriceAlertView[]> {
    const { count } = await this.prisma.priceAlert.deleteMany({ where: { id, userId } });
    if (count === 0) throw new NotFoundException('Price alert not found');
    return this.list(userId);
  }

  private assertTarget(targetPricePaise: number, currentPricePaise: number): void {
    if (targetPricePaise >= currentPricePaise) {
      throw new BadRequestException({
        message: 'Set a target below today’s price',
        field: 'targetPricePaise',
      });
    }
    if (targetPricePaise > Math.floor(currentPricePaise * MIN_DROP_RATIO)) {
      throw new BadRequestException({
        message: 'Set a target at least 1% below today’s price',
        field: 'targetPricePaise',
      });
    }
  }
}
