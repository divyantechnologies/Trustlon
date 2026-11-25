import { Body, Controller, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsUUID, Matches } from 'class-validator';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PageQueryDto } from '../../common/http/pagination';
import { AffiliateService } from './affiliate.service';

class CreateLinkDto {
  @IsUUID()
  productId!: string;
}

class ClickParams {
  @Matches(/^[a-z0-9]{6,12}$/i)
  code!: string;
}

/** Referral and affiliate earnings (spec 3.9). */
@Controller('affiliate')
export class AffiliateController {
  constructor(private readonly affiliate: AffiliateService) {}

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  summary(@CurrentUser() user: AuthUser) {
    return this.affiliate.summary(user.id);
  }

  @Get('links')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  async links(@CurrentUser() user: AuthUser) {
    return { items: await this.affiliate.links(user.id) };
  }

  @Post('links')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async createLink(@CurrentUser() user: AuthUser, @Body() dto: CreateLinkDto) {
    return { items: await this.affiliate.createLink(user.id, dto.productId) };
  }

  @Get('earnings')
  @UseGuards(JwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  earnings(@CurrentUser() user: AuthUser, @Query() query: PageQueryDto) {
    return this.affiliate.earnings(user.id, query.page, query.pageSize);
  }

  /** Called by the storefront when a shopper opens a shared link (/r/:code). */
  @Post('clicks/:code')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  click(@Param() params: ClickParams) {
    return this.affiliate.click(params.code);
  }
}
