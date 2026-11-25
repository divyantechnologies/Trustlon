import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { toPage } from '../../common/http/pagination';
import { localEligibility, LocalRadius } from './local-rules';
import { boundingBox } from '../../common/utils/geo';
import { PrismaService } from '../../prisma/prisma.service';
import { activeVendorWhere, liveProductWhere, productInclude } from '../catalog/catalog.queries';
import { ProductsService } from '../catalog/products.service';

import { PincodeService } from '../location/pincode.service';
import { LocalSeller, StoreSummary, toStoreSummary } from './store.presenter';

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pincodes: PincodeService,
    private readonly products: ProductsService,
  ) {}

  /** Verified brand stores picked by Marketing for the home page. */
  async featured(limit = 8): Promise<StoreSummary[]> {
    const vendors = await this.prisma.vendor.findMany({
      where: { ...activeVendorWhere, isFeatured: true, isVerified: true },
      orderBy: [{ featuredOrder: 'asc' }, { trustScore: 'desc' }],
      take: limit,
    });
    return vendors.map(toStoreSummary);
  }

  /** All verified stores, highest Trust Score first. */
  async verified(): Promise<StoreSummary[]> {
    const vendors = await this.prisma.vendor.findMany({
      where: { ...activeVendorWhere, isVerified: true },
      orderBy: [{ trustScore: 'desc' }, { displayName: 'asc' }],
      take: 100,
    });
    return vendors.map(toStoreSummary);
  }

  async bySlug(slug: string) {
    const vendor = await this.prisma.vendor.findFirst({ where: { ...activeVendorWhere, slug } });
    if (!vendor) throw new NotFoundException('Store not found');
    const productCount = await this.prisma.product.count({
      where: { ...liveProductWhere, vendorId: vendor.id },
    });
    return { ...toStoreSummary(vendor), description: vendor.description, productCount };
  }

  /** Both endpoints use exactly the same server-side eligibility rules. */
  private async eligible(pincode: string, radius: LocalRadius) {
    const origin = await this.pincodes.find(pincode);
    if (!origin?.serviceable || origin.latitude == null || origin.longitude == null) {
      return { serviceable: false, sellers: [] };
    }
    const box = boundingBox(origin.latitude, origin.longitude, radius);
    const candidates = await this.prisma.vendor.findMany({
      where: {
        ...activeVendorWhere,
        kycApprovedAt: { not: null },
        sameDayDelivery: true,
        pickupPincode: { not: null },
        OR: [
          {
            pickupLat: { gte: box.minLat, lte: box.maxLat },
            pickupLng: { gte: box.minLng, lte: box.maxLng },
          },
          {
            pickupLat: null,
            pickupLng: null,
            pickup: {
              latitude: { gte: box.minLat, lte: box.maxLat },
              longitude: { gte: box.minLng, lte: box.maxLng },
            },
          },
        ],
      },
      include: { pickup: true },
    });
    const now = new Date();
    const sellers = candidates
      .flatMap((vendor) => {
        const eligible = localEligibility(vendor, origin.latitude!, origin.longitude!, radius, now);
        return eligible ? [{ vendor, ...eligible }] : [];
      })
      .sort((a, b) => a.distanceKm - b.distanceKm || a.vendor.id.localeCompare(b.vendor.id));
    return { serviceable: true, sellers };
  }

  async localSellers(pincode: string, radiusKm: LocalRadius, page = 1, pageSize = 24) {
    const result = await this.eligible(pincode, radiusKm);
    const selected = result.sellers.slice((page - 1) * pageSize, page * pageSize);
    const sellers: LocalSeller[] = await Promise.all(
      selected.map(async ({ vendor, distanceKm, deliveryPromise }) => {
        const rows = await this.prisma.product.findMany({
          where: { ...liveProductWhere, vendorId: vendor.id, stock: { gt: 0 } },
          include: productInclude,
          orderBy: [{ salesCount: 'desc' }, { id: 'asc' }],
          take: 4,
        });
        const products = await this.products.present(rows);
        return {
          ...toStoreSummary(vendor),
          id: vendor.id,
          storeName: vendor.displayName,
          rating: null,
          area: vendor.localArea,
          category: vendor.localCategory,
          pincode: vendor.pickupPincode!,
          pickupPincode: vendor.pickupPincode!,
          distanceKm: Math.round(distanceKm * 10) / 10,
          sameDayDelivery: vendor.sameDayDelivery,
          deliveryPromise,
          topProducts: products.map((p) => ({
            id: p.id,
            slug: p.slug,
            name: p.name,
            image: p.image,
            price: p.pricePaise,
            pricePaise: p.pricePaise,
          })),
        };
      }),
    );
    return {
      ...toPage(sellers, result.sellers.length, page, pageSize),
      sellers,
      pincode,
      radiusKm,
      serviceable: result.serviceable,
    };
  }

  async localProducts(pincode: string, radiusKm: LocalRadius, page = 1, pageSize = 24) {
    const result = await this.eligible(pincode, radiusKm);
    const ids = result.sellers
      .filter((s) => s.deliveryPromise === 'same_day')
      .map((s) => s.vendor.id);
    const where: Prisma.ProductWhereInput = {
      ...liveProductWhere,
      vendorId: { in: ids },
      stock: { gt: 0 },
    };
    const [total, rows] = ids.length
      ? await Promise.all([
          this.prisma.product.count({ where }),
          this.prisma.product.findMany({
            where,
            include: productInclude,
            orderBy: [{ salesCount: 'desc' }, { id: 'asc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
        ])
      : ([0, []] as const);
    return {
      ...toPage(await this.products.present([...rows]), total, page, pageSize),
      pincode,
      radiusKm,
      serviceable: result.serviceable,
    };
  }
}
