import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SubOrderStatus, WalletEntrySource } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { SUB_ORDER_DELIVERED, SubOrderDeliveredEvent } from '../orders/orders.service';
import { SiteSettingsService } from '../site/site-settings.service';
import { WalletService } from '../wallet/wallet.service';

/** Default reward; the live amount is set in /admin > Business settings. */
export const REFERRAL_REWARD_PAISE = 10_000;

/**
 * Referral reward (spec 1.1): credited once, only after the referred customer's first order is
 * delivered, so fake sign-ups earn nothing.
 */
@Injectable()
export class ReferralRewardListener {
  private readonly logger = new Logger(ReferralRewardListener.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly wallet: WalletService,
    private readonly site: SiteSettingsService,
  ) {}

  @OnEvent(SUB_ORDER_DELIVERED, { async: true })
  async onDelivered(event: SubOrderDeliveredEvent): Promise<void> {
    try {
      await this.reward(event.userId);
    } catch (error) {
      this.logger.error(`Referral reward failed for user ${event.userId}`, error as Error);
    }
  }

  /** Returns true when a reward was credited. Safe to call more than once. */
  async reward(friendId: string): Promise<boolean> {
    const [rewards, features] = await Promise.all([
      this.site.get('rewards'),
      this.site.get('features'),
    ]);
    const rewardPaise = rewards.referral.rewardRupees * 100;
    if (!features.referralProgram || rewardPaise <= 0) return false;
    const friend = await this.prisma.user.findUnique({
      where: { id: friendId },
      select: { referredById: true, fullName: true, deletedAt: true },
    });
    if (!friend?.referredById || friend.deletedAt) return false;
    const delivered = await this.prisma.subOrder.count({
      where: { order: { userId: friendId }, status: SubOrderStatus.DELIVERED },
    });
    if (delivered === 0) return false;

    const referrerId = friend.referredById;
    const reference = `referral:${friendId}`;
    return this.prisma.$transaction(async (tx) => {
      const referrer = await tx.user.findFirst({
        where: { id: referrerId, deletedAt: null },
        select: { id: true },
      });
      if (!referrer) return false;
      const already = await tx.walletEntry.count({
        where: { userId: referrerId, source: WalletEntrySource.REFERRAL, reference },
      });
      if (already > 0) return false;
      await this.wallet.credit(tx, referrerId, {
        amountPaise: rewardPaise,
        source: WalletEntrySource.REFERRAL,
        description: `Referral reward: ${friend.fullName.split(' ')[0]}’s first order was delivered`,
        reference,
      });
      return true;
    });
  }
}
