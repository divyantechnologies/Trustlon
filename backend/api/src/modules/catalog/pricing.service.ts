import { Injectable } from '@nestjs/common';
import { Deal } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Resolves the deal that applies to each product right now. */
@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  activeDealWhere(now = new Date()) {
    return { startsAt: { lte: now }, endsAt: { gt: now } };
  }

  /** Lowest active deal per product id. */
  async activeDeals(productIds: string[], now = new Date()): Promise<Map<string, Deal>> {
    const map = new Map<string, Deal>();
    if (productIds.length === 0) return map;

    const deals = await this.prisma.deal.findMany({
      where: { productId: { in: productIds }, ...this.activeDealWhere(now) },
      orderBy: { dealPricePaise: 'asc' },
    });
    for (const deal of deals) {
      if (!map.has(deal.productId)) map.set(deal.productId, deal);
    }
    return map;
  }

  /** What the customer pays per unit, in paise. */
  effectivePrice(product: { pricePaise: number }, deal?: Deal): number {
    return deal && deal.dealPricePaise < product.pricePaise ? deal.dealPricePaise : product.pricePaise;
  }
}
