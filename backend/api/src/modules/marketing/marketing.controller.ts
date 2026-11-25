import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { actorOf, AuditService } from '../../common/admin/audit.service';
import { AdminController, Can } from '../../common/admin/decorators';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import {
  CreateBannerDto,
  CreateDealDto,
  FeatureStoreDto,
  UpdateBannerDto,
  UpdateDealDto,
  UpdateHomeSectionsDto,
} from './dto';
import { MarketingService } from './marketing.service';

/** Admin panel > Marketing (5.7). Changes show on the home page within 5 minutes (CDN cache). */
@AdminController('marketing')
export class MarketingController {
  constructor(
    private readonly marketing: MarketingService,
    private readonly audit: AuditService,
  ) {}

  @Get('banners')
  @Can('marketing', 'view')
  banners() {
    return this.marketing.listBanners();
  }

  @Post('banners')
  @Can('marketing', 'create')
  async createBanner(
    @Body() dto: CreateBannerDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const banner = await this.marketing.createBanner(dto);
    await this.audit.log(actorOf(user, req), {
      action: 'banner.create',
      entity: 'banner',
      entityId: banner.id,
      summary: banner.title,
      after: dto,
    });
    return banner;
  }

  @Patch('banners/:id')
  @Can('marketing', 'edit')
  async updateBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBannerDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const banner = await this.marketing.updateBanner(id, dto);
    await this.audit.log(actorOf(user, req), {
      action: 'banner.update',
      entity: 'banner',
      entityId: id,
      summary: banner.title,
      after: dto,
    });
    return banner;
  }

  @Delete('banners/:id')
  @Can('marketing', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteBanner(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.marketing.deleteBanner(id);
    await this.audit.log(actorOf(user, req), {
      action: 'banner.delete',
      entity: 'banner',
      entityId: id,
    });
  }

  @Get('home-sections')
  @Can('marketing', 'view')
  homeSections() {
    return this.marketing.homeSections();
  }

  @Put('home-sections')
  @Can('marketing', 'edit')
  async updateHomeSections(
    @Body() dto: UpdateHomeSectionsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const before = await this.marketing.homeSections();
    const after = await this.marketing.updateHomeSections(dto.sections);
    await this.audit.log(actorOf(user, req), {
      action: 'home_sections.update',
      entity: 'home_sections',
      before,
      after,
    });
    return after;
  }

  @Get('deals')
  @Can('marketing', 'view')
  deals() {
    return this.marketing.listDeals();
  }

  @Post('deals')
  @Can('marketing', 'create')
  async createDeal(@Body() dto: CreateDealDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    const deal = await this.marketing.createDeal(dto);
    await this.audit.log(actorOf(user, req), {
      action: 'deal.create',
      entity: 'deal',
      entityId: deal.id,
      after: dto,
    });
    return deal;
  }

  @Patch('deals/:id')
  @Can('marketing', 'edit')
  async updateDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDealDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const deal = await this.marketing.updateDeal(id, dto);
    await this.audit.log(actorOf(user, req), {
      action: 'deal.update',
      entity: 'deal',
      entityId: id,
      after: dto,
    });
    return deal;
  }

  @Delete('deals/:id')
  @Can('marketing', 'edit')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteDeal(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    await this.marketing.deleteDeal(id);
    await this.audit.log(actorOf(user, req), {
      action: 'deal.delete',
      entity: 'deal',
      entityId: id,
    });
  }

  @Patch('stores/:slug/featured')
  @Can('marketing', 'edit')
  async featureStore(
    @Param('slug') slug: string,
    @Body() dto: FeatureStoreDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const store = await this.marketing.featureStore(slug, dto);
    await this.audit.log(actorOf(user, req), {
      action: dto.isFeatured ? 'store.feature' : 'store.unfeature',
      entity: 'vendor',
      entityId: slug,
      summary: store.displayName,
      after: dto,
    });
    return store;
  }
}
