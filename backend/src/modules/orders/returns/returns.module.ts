import { Module } from '@nestjs/common';
import { AddressesModule } from '../../users/addresses/addresses.module';
import { WalletModule } from '../../users/wallet/wallet.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [AddressesModule, WalletModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
