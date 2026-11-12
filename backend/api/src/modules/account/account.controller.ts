import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AccountService } from './account.service';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class AccountController {
  constructor(private readonly account: AccountService) {}

  /** Everything the My Account overview shows, in one call. */
  @Get('summary')
  @Header('Cache-Control', 'private, no-store')
  summary(@CurrentUser() user: AuthUser) {
    return this.account.summary(user.id);
  }
}
