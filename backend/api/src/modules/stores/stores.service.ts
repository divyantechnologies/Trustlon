import { Injectable, NotFoundException } from '@nestjs/common';
import { Vendor } from '@prisma/client';
import { boundingBox, distanceKm } from '../../common/utils/geo';
import { PrismaService } from '../../prisma/prisma.service';
import { activeVendorWhere, liveProductWhere, productInclude } from '../catalog/catalog.queries';
import { ProductsService } from '../catalog/products.service';
import { ProductSummary } from '../catalog/product.presenter';
import { PincodeService } from '../location/pincode.service';
import { LocalSeller, StoreSummary, toStoreSummary } from './store.presenter';

export const LOCAL_RADII_KM = [5, 10, 25] as const;
export type LocalRadius = (typeof LOCAL_RADII_KM)[number];

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

  /**
   * Sellers with same-day delivery whose pickup pincode is within `radiusKm` of the customer.
   * Returns `serviceable: false` with no sellers when the pincode is unknown.
   */
  async localSellers(
    pincode: string,
    radiusKm: LocalRadius,
  ): Promise<{ pincode: string; radiusKm: number; serviceable: boolean; sellers: LocalSeller[] }> {
    const origin = await this.pincodes.find(pincode);
    if (!origin || origin.latitude === null || origin.longitude === null) {
      return { pincode, radiusKm, serviceable: false, sellers: [] };
    }

    const box = boundingBox(origin.latitude, origin.longitude, radiusKm);
    const candidates = await this.prisma.vendor.findMany({
      where: {
        ...activeVendorWhere,
        sameDayDelivery: true,
        pickup: {
          latitude: { gte: box.minLat, lte: box.maxLat },
          longitude: { gte: box.minLng, lte: box.maxLng },
        },
      },
      include: { pickup: true },
      take: 200,
    });

    const sellers = candidates
      .map((vendor) => this.toLocalSeller(vendor, origin.latitude!, origin.longitude!))
      .filter((seller): seller is LocalSeller => seller !== null && seller.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm || b.trustScore - a.trustScore);

    return { pincode, radiusKm, serviceable: origin.serviceable, sellers };
  }

  /** Products from local sellers, nearest seller first. */
  async localProducts(pincode: string, radiusKm: LocalRadius, limit = 24): Promise<ProductSummary[]> {
    const { sellers } = await this.localSellers(pincode, radiusKm);
    if (sellers.length === 0) return [];
    const order = new Map(sellers.map((seller, index) => [seller.slug, index]));

    const rows = await this.prisma.product.findMany({
      where: { ...liveProductWhere, vendor: { slug: { in: sellers.map((s) => s.slug) } } },
      include: productInclude,
      orderBy: [{ salesCount: 'desc' }],
      take: limit,
    });
    rows.sort((a, b) => (order.get(a.vendor.slug) ?? 0) - (order.get(b.vendor.slug) ?? 0));
    return this.products.present(rows);
  }

  private toLocalSeller(
    vendor: Vendor & { pickup: { pincode: string; latitude: number | null; longitude: number | null } | null },
    lat: number,
    lng: number,
  ): LocalSeller | null {
    if (!vendor.pickup || vendor.pickup.latitude === null || vendor.pickup.longitude === null) {
      return null;
    }
    const km = distanceKm(lat, lng, vendor.pickup.latitude, vendor.pickup.longitude);
    return {
      ...toStoreSummary(vendor),
      area: vendor.localArea,
      category: vendor.localCategory,
      pincode: vendor.pickup.pincode,
      distanceKm: Math.round(km * 10) / 10,
      sameDayDelivery: vendor.sameDayDelivery,
    };
  }
}
