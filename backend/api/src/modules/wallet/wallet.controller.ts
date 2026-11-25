import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { IsIn, IsOptional } from 'class-validator';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PageQueryDto } from '../../common/http/pagination';
import { WALLET_ENTRY_FILTERS, WalletEntryFilter, WalletService } from './wallet.service';

class WalletTransactionsQueryDto extends PageQueryDto {
  /** refund, cashback, referral, spend or other. */
  @IsOptional()
  @IsIn(Object.keys(WALLET_ENTRY_FILTERS))
  type?: WalletEntryFilter;
}

/** Wallet and Trustlon Coins (spec 3.6). Read-only: balances change only through ledger entries. */
@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly wallet: WalletService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  overview(@CurrentUser() user: AuthUser) {
    return this.wallet.overview(user.id);
  }

  @Get('transactions')
  @Header('Cache-Control', 'private, no-store')
  transactions(@CurrentUser() user: AuthUser, @Query() query: WalletTransactionsQueryDto) {
    return this.wallet.transactions(user.id, query);
  }
}
