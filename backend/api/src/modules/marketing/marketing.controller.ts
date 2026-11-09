import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import {
  CreateBannerDto,
  CreateDealDto,
  FeatureStoreDto,
  UpdateBannerDto,
  UpdateDealDto,
  UpdateHomeSectionsDto,
} from './dto';
import { MarketingService } from './marketing.service';

/** Admin panel > Marketing. Changes show on the home page within 5 minutes (CDN cache). */
@Controller('admin/marketing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.MARKETING)
export class MarketingController {
  constructor(private readonly marketing: MarketingService) {}

  @Get('banners')
  banners() {
    return this.marketing.listBanners();
  }

  @Post('banners')
  createBanner(@Body() dto: CreateBannerDto) {
    return this.marketing.createBanner(dto);
  }

  @Patch('banners/:id')
  updateBanner(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBannerDto) {
    return this.marketing.updateBanner(id, dto);
  }

  @Delete('banners/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteBanner(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketing.deleteBanner(id);
  }

  @Get('home-sections')
  homeSections() {
    return this.marketing.homeSections();
  }

  @Put('home-sections')
  updateHomeSections(@Body() dto: UpdateHomeSectionsDto) {
    return this.marketing.updateHomeSections(dto.sections);
  }

  @Get('deals')
  deals() {
    return this.marketing.listDeals();
  }

  @Post('deals')
  createDeal(@Body() dto: CreateDealDto) {
    return this.marketing.createDeal(dto);
  }

  @Patch('deals/:id')
  updateDeal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDealDto) {
    return this.marketing.updateDeal(id, dto);
  }

  @Delete('deals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDeal(@Param('id', ParseUUIDPipe) id: string) {
    return this.marketing.deleteDeal(id);
  }

  @Patch('stores/:slug/featured')
  featureStore(@Param('slug') slug: string, @Body() dto: FeatureStoreDto) {
    return this.marketing.featureStore(slug, dto);
  }
}
