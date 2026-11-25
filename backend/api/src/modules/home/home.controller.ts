import { Controller, Get, Header, Query, UseGuards } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { OptionalJwtAuthGuard } from '../../common/auth/optional-jwt-auth.guard';
import { CurrentShopper, Shopper } from '../../common/shopper/shopper';
import { HomeService } from './home.service';
import { RecommendationsService } from './recommendations.service';

class RecommendationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit = 10;
}

@Controller()
export class HomeController {
  constructor(
    private readonly home: HomeService,
    private readonly recommendations: RecommendationsService,
  ) {}

  /** Single aggregated call for the home page; cached at the CDN for 5 minutes. */
  @Get('home')
  @Header('Cache-Control', 'public, max-age=60, s-maxage=300')
  getHome() {
    return this.home.home();
  }

  /** Personal: send the Bearer token or the x-guest-token header. Works without either too. */
  @Get('recommendations')
  @UseGuards(OptionalJwtAuthGuard)
  @Header('Cache-Control', 'private, no-store')
  async recommend(
    @CurrentShopper({ required: false }) shopper: Shopper | null,
    @Query() query: RecommendationQueryDto,
  ) {
    return { items: await this.recommendations.forShopper(shopper, query.limit) };
  }
}
