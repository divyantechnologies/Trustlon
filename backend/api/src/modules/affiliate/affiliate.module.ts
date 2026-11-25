import { Module } from '@nestjs/common';
import { AffiliateController } from './affiliate.controller';
import { AffiliateService } from './affiliate.service';
import { WalletModule } from '../wallet/wallet.module';
import { ReferralRewardListener } from './referral.listener';

/** Checkout (2.8) creates AffiliateEarning rows for attributed orders; payouts run through Finance (7.2). */
@Module({
  imports: [WalletModule],
  controllers: [AffiliateController],
  providers: [AffiliateService, ReferralRewardListener],
  exports: [AffiliateService],
})
export class AffiliateModule {}
