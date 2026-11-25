import { Injectable, NotFoundException } from '@nestjs/common';
import { AffiliateEarningStatus, Prisma, WalletEntrySource } from '@prisma/client';
import { randomInt } from 'crypto';
import { Page, toPage } from '../../../utils/http/pagination';
import { PrismaService } from '../../../database/prisma.service';
import { liveProductWhere } from '../../catalog/catalog.queries';
import { SiteSettingsService } from '../../site/site-settings.service';

/** Default commission on affiliate sales (500 = 5%); the live value is in /admin > Business settings. */
export const AFFILIATE_COMMISSION_BPS = 500;
/** How long a click is remembered in the shopper's browser for attribution. */
export const ATTRIBUTION_DAYS = 30;

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function newCode(): string {
  return Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(0, CODE_ALPHABET.length)]).join(
    '',
  );
}

export interface AffiliateSummary {
  referral: { code: string; path: string; friendsJoined: number; rewardsPaise: number };
  affiliate: {
    links: number;
    clicks: number;
    orders: number;
    pendingPaise: number;
    confirmedPaise: number;
    paidPaise: number;
  };
  rules: { commissionPercent: number; attributionDays: number; referralRewardPaise: number };
}

export interface AffiliateLinkView {
  id: string;
  code: string;
  path: string;
  clicks: number;
  createdAt: Date;
  product: { id: string; slug: string; name: string; image: string; pricePaise: number } | null;
}

export interface AffiliateEarningView {
  id: string;
  orderNumber: string;
  productName: string;
  saleAmountPaise: number;
  commissionPaise: number;
  status: AffiliateEarningStatus;
  confirmAfter: Date;
  createdAt: Date;
}

const linkPath = (code: string) => `/r/${code}`;

@Injectable()
export class AffiliateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly site: SiteSettingsService,
  ) {}

  async summary(userId: string): Promise<AffiliateSummary> {
    await this.confirmDue(userId);
    const [rules, features] = await Promise.all([
      this.site.get('rewards'),
      this.site.get('features'),
    ]);
    const [user, friendsJoined, rewards, links, earnings] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { referralCode: true } }),
      this.prisma.user.count({ where: { referredById: userId, deletedAt: null } }),
      this.prisma.walletEntry.aggregate({
        where: { userId, source: WalletEntrySource.REFERRAL },
        _sum: { amountPaise: true },
      }),
      this.prisma.affiliateLink.aggregate({
        where: { userId },
        _count: { _all: true },
        _sum: { clicks: true },
      }),
      this.prisma.affiliateEarning.groupBy({
        by: ['status'],
        where: { userId },
        _sum: { commissionPaise: true },
        _count: { _all: true },
      }),
    ]);
    const sum = (status: AffiliateEarningStatus) =>
      earnings.find((row) => row.status === status)?._sum.commissionPaise ?? 0;
    return {
      referral: {
        code: user.referralCode,
        path: `/signup?ref=${user.referralCode}`,
        friendsJoined,
        rewardsPaise: rewards._sum.amountPaise ?? 0,
      },
      affiliate: {
        links: links._count._all,
        clicks: links._sum.clicks ?? 0,
        orders: earnings
          .filter((row) => row.status !== AffiliateEarningStatus.CANCELLED)
          .reduce((total, row) => total + row._count._all, 0),
        pendingPaise: sum(AffiliateEarningStatus.PENDING),
        confirmedPaise: sum(AffiliateEarningStatus.CONFIRMED),
        paidPaise: sum(AffiliateEarningStatus.PAID),
      },
      rules: {
        commissionPercent: rules.affiliate.commissionPercent,
        attributionDays: rules.affiliate.attributionDays,
        referralRewardPaise: features.referralProgram ? rules.referral.rewardRupees * 100 : 0,
      },
    };
  }

  async links(userId: string): Promise<AffiliateLinkView[]> {
    const rows = await this.prisma.affiliateLink.findMany({
      where: { userId },
      include: {
        product: {
          select: {
            id: true,
            slug: true,
            name: true,
            imageUrl: true,
            pricePaise: true,
            status: true,
            deletedAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      path: linkPath(row.code),
      clicks: row.clicks,
      createdAt: row.createdAt,
      product:
        row.product.deletedAt || row.product.status !== 'LIVE'
          ? null
          : {
              id: row.product.id,
              slug: row.product.slug,
              name: row.product.name,
              image: row.product.imageUrl,
              pricePaise: row.product.pricePaise,
            },
    }));
  }

  /** One link per product per customer; asking again returns the same link. */
  async createLink(userId: string, productId: string): Promise<AffiliateLinkView[]> {
    const product = await this.prisma.product.findFirst({
      where: { ...liveProductWhere, id: productId },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found');
    const existing = await this.prisma.affiliateLink.findUnique({
      where: { userId_productId: { userId, productId } },
    });
    if (!existing) {
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          await this.prisma.affiliateLink.create({ data: { userId, productId, code: newCode() } });
          break;
        } catch (error) {
          const clash =
            error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
          if (!clash || attempt === 4) throw error;
        }
      }
    }
    return this.links(userId);
  }

  async earnings(
    userId: string,
    page: number,
    pageSize: number,
  ): Promise<Page<AffiliateEarningView>> {
    await this.confirmDue(userId);
    const [rows, total] = await Promise.all([
      this.prisma.affiliateEarning.findMany({
        where: { userId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.affiliateEarning.count({ where: { userId } }),
    ]);
    return toPage(
      rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        productName: row.productName,
        saleAmountPaise: row.saleAmountPaise,
        commissionPaise: row.commissionPaise,
        status: row.status,
        confirmAfter: row.confirmAfter,
        createdAt: row.createdAt,
      })),
      total,
      page,
      pageSize,
    );
  }

  /** Records a click and tells the storefront where to send the shopper. Public. */
  async click(
    code: string,
  ): Promise<{ code: string; product: { slug: string; name: string; categorySlug: string } }> {
    const link = await this.prisma.affiliateLink.findUnique({
      where: { code: code.toLowerCase() },
      include: {
        product: {
          select: {
            slug: true,
            name: true,
            status: true,
            deletedAt: true,
            category: { select: { slug: true } },
          },
        },
      },
    });
    if (!link || link.product.deletedAt || link.product.status !== 'LIVE')
      throw new NotFoundException('Link not found');
    await this.prisma.affiliateLink.update({
      where: { id: link.id },
      data: { clicks: { increment: 1 } },
    });
    return {
      code: link.code,
      product: {
        slug: link.product.slug,
        name: link.product.name,
        categorySlug: link.product.category.slug,
      },
    };
  }

  /** Spec 3.9: a commission is confirmed only after the item's return window closes. */
  private async confirmDue(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.affiliateEarning.updateMany({
      where: { userId, status: AffiliateEarningStatus.PENDING, confirmAfter: { lte: now } },
      data: { status: AffiliateEarningStatus.CONFIRMED, confirmedAt: now },
    });
  }
}
