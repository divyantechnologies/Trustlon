import { Module } from '@nestjs/common';
import { WalletService } from './wallet.service';

/** Wallet balance and Trustlon Coins. The wallet page (3.6) adds its controller here. */
@Module({
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
