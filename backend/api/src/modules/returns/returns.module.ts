import { Module } from '@nestjs/common';
import { AddressesModule } from '../addresses/addresses.module';
import { WalletModule } from '../wallet/wallet.module';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

@Module({
  imports: [AddressesModule, WalletModule],
  controllers: [ReturnsController],
  providers: [ReturnsService],
  exports: [ReturnsService],
})
export class ReturnsModule {}
