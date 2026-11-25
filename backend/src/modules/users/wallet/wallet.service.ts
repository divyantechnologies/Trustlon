import { Injectable } from '@nestjs/common';
import { Prisma, WalletEntrySource, WalletEntryType } from '@prisma/client';
import { Page, toPage } from '../../../utils/http/pagination';
import { PrismaService } from '../../../database/prisma.service';
import { SiteSettingsService } from '../../site/site-settings.service';

/**
 * Default Trustlon Coins rules. Finance changes the live values in /admin > Business settings
 * (Platform settings, 5.9); these apply until then.
 */
export const COIN_RULES = {
  /** Value of one coin at checkout, in paise. */
  coinValuePaise: 100,
  /** Share of an order total that coins can pay for, in percent. */
  maxRedeemPercent: 10,
  /** Coins earned per ₹100 spent on delivered orders. */
  earnPerHundredRupees: 1,
  /** Coins expire this many months after they are earned. */
  expiryMonths: 12,
} as const;

/** Window used for the "expiring soon" figure. */
const EXPIRING_SOON_DAYS = 30;

export interface WalletBalance {
  balancePaise: number;
  coins: number;
}

export interface WalletOverview extends WalletBalance {
  coinsExpiringSoon: { coins: number; withinDays: number; nextExpiry: Date | null };
  totals: { creditedPaise: number; spentPaise: number };
  rules: {
    coinValuePaise: number;
    maxRedeemPercent: number;
    earnPerHundredRupees: number;
    expiryMonths: number;
  };
}

export interface WalletCredit {
  amountPaise: number;
  coins?: number;
  source: WalletEntrySource;
  description: string;
  reference?: string;
  /** Defaults to the coin expiry rule when coins are credited. */
  coinsExpireAt?: Date;
}

export const WALLET_ENTRY_FILTERS = {
  refund: [WalletEntrySource.REFUND],
  cashback: [WalletEntrySource.CASHBACK],
  referral: [WalletEntrySource.REFERRAL],
  spend: [WalletEntrySource.ORDER_PAYMENT],
  other: [WalletEntrySource.ADJUSTMENT],
} as const satisfies Record<string, readonly WalletEntrySource[]>;

export type WalletEntryFilter = keyof typeof WALLET_ENTRY_FILTERS;

export interface WalletTransaction {
  id: string;
  type: WalletEntryType;
  source: WalletEntrySource;
  amountPaise: number;
  coins: number;
  balanceAfterPaise: number;
  description: string;
  reference: string | null;
  coinsExpireAt: Date | null;
  createdAt: Date;
}

export function coinExpiryFrom(date: Date, expiryMonths: number = COIN_RULES.expiryMonths): Date {
  const expiry = new Date(date);
  expiry.setMonth(expiry.getMonth() + expiryMonths);
  return expiry;
}

@Injectable()
export class WalletService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly site: SiteSettingsService,
  ) {}

  async balance(userId: string): Promise<WalletBalance> {
    const wallet = await this.prisma.wallet.findUnique({
      where: { userId },
      select: { balancePaise: true, coins: true },
    });
    return wallet ?? { balancePaise: 0, coins: 0 };
  }

  /** Balances come from the wallet row, which only ever changes together with a ledger entry. */
  async overview(userId: string, now = new Date()): Promise<WalletOverview> {
    const soon = new Date(now.getTime() + EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000);
    const [balance, expiring, credited, spent] = await Promise.all([
      this.balance(userId),
      this.prisma.walletEntry.aggregate({
        where: {
          userId,
          type: WalletEntryType.CREDIT,
          coins: { gt: 0 },
          coinsExpireAt: { gt: now, lte: soon },
        },
        _sum: { coins: true },
        _min: { coinsExpireAt: true },
      }),
      this.prisma.walletEntry.aggregate({
        where: { userId, type: WalletEntryType.CREDIT },
        _sum: { amountPaise: true },
      }),
      this.prisma.walletEntry.aggregate({
        where: { userId, type: WalletEntryType.DEBIT },
        _sum: { amountPaise: true },
      }),
    ]);
    return {
      ...balance,
      // Never show more coins expiring than the customer still holds.
      coinsExpiringSoon: {
        coins: Math.min(balance.coins, expiring._sum.coins ?? 0),
        withinDays: EXPIRING_SOON_DAYS,
        nextExpiry: expiring._min.coinsExpireAt ?? null,
      },
      totals: {
        creditedPaise: credited._sum.amountPaise ?? 0,
        spentPaise: spent._sum.amountPaise ?? 0,
      },
      rules: (await this.site.get('rewards')).coins,
    };
  }

  async transactions(
    userId: string,
    query: { page: number; pageSize: number; type?: WalletEntryFilter },
  ): Promise<Page<WalletTransaction>> {
    const where: Prisma.WalletEntryWhereInput = {
      userId,
      ...(query.type ? { source: { in: [...WALLET_ENTRY_FILTERS[query.type]] } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.walletEntry.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.walletEntry.count({ where }),
    ]);
    return toPage(
      rows.map((row) => ({
        id: row.id,
        type: row.type,
        source: row.source,
        amountPaise: row.amountPaise,
        coins: row.coins,
        balanceAfterPaise: row.balanceAfterPaise,
        description: row.description,
        reference: row.reference,
        coinsExpireAt: row.coinsExpireAt,
        createdAt: row.createdAt,
      })),
      total,
      query.page,
      query.pageSize,
    );
  }

  /** Adds money or coins and records the entry. Pass the transaction the change belongs to. */
  async credit(tx: Prisma.TransactionClient, userId: string, credit: WalletCredit) {
    const coins = credit.coins ?? 0;
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId, balancePaise: credit.amountPaise, coins },
      update: { balancePaise: { increment: credit.amountPaise }, coins: { increment: coins } },
    });
    return tx.walletEntry.create({
      data: {
        userId,
        type: WalletEntryType.CREDIT,
        source: credit.source,
        amountPaise: credit.amountPaise,
        coins,
        balanceAfterPaise: wallet.balancePaise,
        description: credit.description,
        reference: credit.reference,
        coinsExpireAt:
          coins > 0
            ? (credit.coinsExpireAt ??
              coinExpiryFrom(new Date(), (await this.site.get('rewards')).coins.expiryMonths))
            : null,
      },
    });
  }
}
