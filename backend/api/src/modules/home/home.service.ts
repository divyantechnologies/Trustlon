import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Banner, BannerPlacement, HomeSectionKey } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { liveProductWhere, productInclude } from '../catalog/catalog.queries';
import { CategoriesService, CategoryNode } from '../catalog/categories.service';
import { ProductsService } from '../catalog/products.service';
import { ProductSummary, toProductSummary } from '../catalog/product.presenter';
import { MARKETING_CHANGED } from '../marketing/marketing.events';
import { MarketingService } from '../marketing/marketing.service';
import { StoreSummary } from '../stores/store.presenter';
import { StoresService } from '../stores/stores.service';

export interface BannerView {
  id: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  cta: string;
  image: string;
  mobileImage: string | null;
  href: string;
  tag: string | null;
  highlights: string[];
}

export interface HomeSectionView {
  key: HomeSectionKey;
  title: string | null;
  subtitle: string | null;
}

/**
 * Everything on the home page that is the same for every visitor.
 * Personal parts (recently viewed, recommendations, local sellers) have their own endpoints.
 */
export interface HomeView {
  sections: HomeSectionView[];
  banners: BannerView[];
  /** Promotional placements around the hero: sale strip, wide banners, side ads. */
  promos: { strip: BannerView | null; wide: BannerView[]; side: BannerView[] };
  categories: CategoryNode[];
  deals: { endsAt: Date | null; items: ProductSummary[] };
  originals: ProductSummary[];
  /** Most viewed in the last 24 hours ("Today's view"), topped up with popular products. */
  trending: ProductSummary[];
  /** Combo / bundle products. */
  combos: ProductSummary[];
  featuredStores: StoreSummary[];
  generatedAt: Date;
}

const CACHE_MS = 60_000;

@Injectable()
export class HomeService {
  private cache: { value: HomeView; expiresAt: number } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly stores: StoresService,
    private readonly marketing: MarketingService,
  ) {}

  async home(): Promise<HomeView> {
    if (this.cache && this.cache.expiresAt > Date.now()) return this.cache.value;
    const value = await this.build();
    this.cache = { value, expiresAt: Date.now() + CACHE_MS };
    return value;
  }

  @OnEvent(MARKETING_CHANGED)
  invalidate(): void {
    this.cache = null;
  }

  private async build(): Promise<HomeView> {
    const now = new Date();
    const [sections, banners, categories, deals, originals, trending, combos, featuredStores] =
      await Promise.all([
        this.marketing.homeSections(),
        this.banners(now),
        this.categories.tree(),
        this.deals(now),
        this.originals(),
        this.trending(now),
        this.combos(),
        this.stores.featured(),
      ]);

    return {
      sections: sections
        .filter((section) => section.isEnabled)
        .map((section) => ({ key: section.key, title: section.title, subtitle: section.subtitle })),
      banners: banners.filter((b) => b.placement === BannerPlacement.HOME_HERO).map(toBannerView),
      promos: {
        strip:
          banners.filter((b) => b.placement === BannerPlacement.HOME_STRIP).map(toBannerView)[0] ??
          null,
        wide: banners.filter((b) => b.placement === BannerPlacement.HOME_WIDE).map(toBannerView),
        side: banners.filter((b) => b.placement === BannerPlacement.HOME_SIDE).map(toBannerView),
      },
      categories,
      deals,
      originals,
      trending,
      combos,
      featuredStores,
      generatedAt: now,
    };
  }

  /** All active, scheduled-in banners for every home placement. */
  private banners(now: Date) {
    return this.prisma.banner.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gt: now } }] },
        ],
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 40,
    });
  }

  /** Active deals on live products. `endsAt` is the earliest end, for the countdown. */
  private async deals(now: Date): Promise<HomeView['deals']> {
    const rows = await this.prisma.deal.findMany({
      where: {
        startsAt: { lte: now },
        endsAt: { gt: now },
        product: liveProductWhere,
      },
      orderBy: [{ sortOrder: 'asc' }, { dealPricePaise: 'asc' }],
      include: { product: { include: productInclude } },
      take: 40,
    });

    const seen = new Set<string>();
    const items: ProductSummary[] = [];
    let endsAt: Date | null = null;
    for (const deal of rows) {
      if (seen.has(deal.productId)) continue;
      seen.add(deal.productId);
      items.push(toProductSummary(deal.product, deal));
      if (!endsAt || deal.endsAt < endsAt) endsAt = deal.endsAt;
      if (items.length === 12) break;
    }
    return { endsAt, items };
  }

  private async trending(now: Date, limit = 8): Promise<ProductSummary[]> {
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const viewed = await this.prisma.recentlyViewed.groupBy({
      by: ['productId'],
      where: { viewedAt: { gte: since }, product: liveProductWhere },
      _count: { productId: true },
      orderBy: { _count: { productId: 'desc' } },
      take: limit,
    });
    const ids = viewed.map((row) => row.productId);

    if (ids.length < limit) {
      const popular = await this.prisma.product.findMany({
        where: { AND: [liveProductWhere, { id: { notIn: ids } }, { isBundle: false }] },
        select: { id: true },
        orderBy: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }],
        take: limit - ids.length,
      });
      ids.push(...popular.map((row) => row.id));
    }
    return this.products.byIds(ids);
  }

  private async combos(): Promise<ProductSummary[]> {
    const rows = await this.prisma.product.findMany({
      where: { AND: [liveProductWhere, { isBundle: true }] },
      include: productInclude,
      orderBy: [{ salesCount: 'desc' }, { createdAt: 'desc' }],
      take: 12,
    });
    return this.products.present(rows);
  }

  private async originals(): Promise<ProductSummary[]> {
    const rows = await this.prisma.product.findMany({
      where: { AND: [liveProductWhere, { vendor: { isPlatformOwned: true } }, { isBundle: false }] },
      include: productInclude,
      orderBy: [{ salesCount: 'desc' }, { ratingAvg: 'desc' }],
      take: 8,
    });
    return this.products.present(rows);
  }
}

function toBannerView(banner: Banner): BannerView {
  return {
    id: banner.id,
    eyebrow: banner.eyebrow,
    title: banner.title,
    subtitle: banner.subtitle,
    cta: banner.ctaLabel,
    image: banner.imageUrl,
    mobileImage: banner.mobileImageUrl,
    href: banner.href,
    tag: banner.tagLabel,
    highlights: banner.highlights,
  };
}
