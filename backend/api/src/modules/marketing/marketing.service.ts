import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BannerPlacement, HomeSectionKey } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateBannerDto,
  CreateDealDto,
  FeatureStoreDto,
  HomeSectionDto,
  UpdateBannerDto,
  UpdateDealDto,
} from './dto';
import { MARKETING_CHANGED } from './marketing.events';

/** Default order of home page sections (spec 2.1) when Marketing has not changed it. */
export const DEFAULT_HOME_SECTIONS: Array<{ key: HomeSectionKey; title: string; subtitle?: string }> = [
  { key: HomeSectionKey.HERO_BANNERS, title: 'Featured' },
  { key: HomeSectionKey.CATEGORY_TILES, title: 'Shop by category' },
  {
    key: HomeSectionKey.DEALS_OF_THE_DAY,
    title: 'Deals of the day',
    subtitle: 'Great finds. Even better prices.',
  },
  { key: HomeSectionKey.TRUSTLON_ORIGINALS, title: 'Trustlon Originals' },
  { key: HomeSectionKey.FEATURED_STORES, title: 'Verified brand stores' },
  { key: HomeSectionKey.LOCAL_SELLERS, title: 'Good things, closer to home' },
  { key: HomeSectionKey.RECENTLY_VIEWED, title: 'Recently viewed' },
  { key: HomeSectionKey.RECOMMENDED, title: 'Picked for you' },
  { key: HomeSectionKey.TRUST_STRIP, title: 'Shop with confidence' },
];

export interface HomeSectionSetting {
  key: HomeSectionKey;
  title: string | null;
  subtitle: string | null;
  isEnabled: boolean;
  sortOrder: number;
}

@Injectable()
export class MarketingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  /* Banners */

  listBanners() {
    return this.prisma.banner.findMany({
      orderBy: [{ placement: 'asc' }, { priority: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async createBanner(dto: CreateBannerDto) {
    assertWindow(dto.startsAt, dto.endsAt);
    const banner = await this.prisma.banner.create({
      data: { ...dto, placement: dto.placement ?? BannerPlacement.HOME_HERO },
    });
    this.changed();
    return banner;
  }

  async updateBanner(id: string, dto: UpdateBannerDto) {
    const existing = await this.prisma.banner.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Banner not found');
    assertWindow(dto.startsAt ?? existing.startsAt, dto.endsAt ?? existing.endsAt);
    const banner = await this.prisma.banner.update({ where: { id }, data: dto });
    this.changed();
    return banner;
  }

  async deleteBanner(id: string) {
    const result = await this.prisma.banner.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException('Banner not found');
    this.changed();
  }

  /* Home sections */

  async homeSections(): Promise<HomeSectionSetting[]> {
    const rows = await this.prisma.homeSection.findMany({
      orderBy: { sortOrder: 'asc' },
      select: { key: true, title: true, subtitle: true, isEnabled: true, sortOrder: true },
    });
    if (rows.length > 0) return rows;
    return DEFAULT_HOME_SECTIONS.map((section, index) => ({
      key: section.key,
      title: section.title,
      subtitle: section.subtitle ?? null,
      isEnabled: true,
      sortOrder: index,
    }));
  }

  async updateHomeSections(sections: HomeSectionDto[]) {
    const keys = new Set(sections.map((s) => s.key));
    if (keys.size !== sections.length) throw new BadRequestException('Each section may appear once');

    await this.prisma.$transaction(
      sections.map((section) =>
        this.prisma.homeSection.upsert({
          where: { key: section.key },
          create: section,
          update: section,
        }),
      ),
    );
    this.changed();
    return this.homeSections();
  }

  /* Deals */

  listDeals() {
    return this.prisma.deal.findMany({
      orderBy: [{ startsAt: 'desc' }, { sortOrder: 'asc' }],
      include: { product: { select: { slug: true, name: true, pricePaise: true } } },
      take: 200,
    });
  }

  async createDeal(dto: CreateDealDto) {
    assertWindow(dto.startsAt, dto.endsAt);
    await this.assertDealPrice(dto.productId, dto.dealPricePaise);
    const deal = await this.prisma.deal.create({ data: dto });
    this.changed();
    return deal;
  }

  async updateDeal(id: string, dto: UpdateDealDto) {
    const existing = await this.prisma.deal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Deal not found');
    assertWindow(dto.startsAt ?? existing.startsAt, dto.endsAt ?? existing.endsAt);
    if (dto.dealPricePaise !== undefined) {
      await this.assertDealPrice(existing.productId, dto.dealPricePaise);
    }
    const deal = await this.prisma.deal.update({ where: { id }, data: dto });
    this.changed();
    return deal;
  }

  async deleteDeal(id: string) {
    const result = await this.prisma.deal.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException('Deal not found');
    this.changed();
  }

  /* Featured stores */

  async featureStore(slug: string, dto: FeatureStoreDto) {
    const vendor = await this.prisma.vendor.findUnique({ where: { slug } });
    if (!vendor) throw new NotFoundException('Store not found');
    if (dto.isFeatured && !vendor.isVerified) {
      throw new BadRequestException('Only verified stores can be featured');
    }
    const updated = await this.prisma.vendor.update({
      where: { slug },
      data: { isFeatured: dto.isFeatured, featuredOrder: dto.featuredOrder ?? vendor.featuredOrder },
      select: { slug: true, displayName: true, isFeatured: true, featuredOrder: true },
    });
    this.changed();
    return updated;
  }

  private async assertDealPrice(productId: string, dealPricePaise: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { pricePaise: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    if (dealPricePaise >= product.pricePaise) {
      throw new BadRequestException('Deal price must be lower than the current selling price');
    }
  }

  private changed() {
    this.events.emit(MARKETING_CHANGED);
  }
}

function assertWindow(startsAt?: Date | null, endsAt?: Date | null) {
  if (startsAt && endsAt && endsAt <= startsAt) {
    throw new BadRequestException('End time must be after start time');
  }
}
