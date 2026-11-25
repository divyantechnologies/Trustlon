import {
  BadRequestException,
  Body,
  Delete,
  ForbiddenException,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'crypto';
import type { Request } from 'express';
import { actorOf, AuditService } from '../../../middlewares/admin/audit.service';
import { AdminController, Can } from '../../../middlewares/admin/decorators';
import { Permission } from '../../../middlewares/admin/permissions';
import { PermissionsService } from '../../../middlewares/admin/permissions.service';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { detectImageType, FileStorage } from '../../../utils/storage/file-storage';
import { AdminContentService } from './content.service';
import { CouponDto, PageDto, RedirectDto, SeoDto, UpdateCouponDto, UpdatePageDto } from './dto';

const IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const KINDS = ['banner', 'category', 'seo', 'logo', 'page'] as const;
const KIND_PERMISSION: Record<(typeof KINDS)[number], Permission[]> = {
  banner: ['marketing:create', 'marketing:edit'],
  category: ['catalog:create', 'catalog:edit'],
  seo: ['marketing:edit'],
  logo: ['settings:edit'],
  page: ['marketing:edit'],
};

@AdminController('')
export class AdminContentController {
  constructor(
    private readonly content: AdminContentService,
    private readonly storage: FileStorage,
    private readonly permissions: PermissionsService,
    private readonly audit: AuditService,
  ) {}

  /** Uploads an image (banner, category, SEO share image, logo) and returns its public URL. */
  @Post('assets')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: IMAGE_MAX_BYTES, files: 1 } }))
  async upload(
    @Query('kind') kind: string,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    if (!(KINDS as readonly string[]).includes(kind))
      throw new BadRequestException('Unknown image kind');
    const needed = KIND_PERMISSION[kind as (typeof KINDS)[number]];
    const allowed = await Promise.all(needed.map((p) => this.permissions.has(user.role, p)));
    if (!allowed.some(Boolean)) throw new ForbiddenException('Your role does not allow this');
    if (!file) throw new BadRequestException('Choose an image');
    const type = detectImageType(file.buffer);
    if (!type) throw new BadRequestException('Use a PNG, JPG or WebP image');
    const name = `${kind}-${randomBytes(8).toString('hex')}.${type.extension}`;
    await this.storage.put(`site/${name}`, file.buffer);
    await this.audit.log(actorOf(user, req), {
      action: 'asset.upload',
      entity: 'asset',
      entityId: name,
      summary: kind,
    });
    return { url: `/api/v1/site/assets/${name}` };
  }

  @Get('coupons')
  @Can('marketing', 'view')
  coupons() {
    return this.content.coupons();
  }

  @Post('coupons')
  @Can('marketing', 'create')
  createCoupon(@Body() dto: CouponDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.content.createCoupon(dto, actorOf(user, req));
  }

  @Patch('coupons/:id')
  @Can('marketing', 'edit')
  updateCoupon(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCouponDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.content.updateCoupon(id, dto, actorOf(user, req));
  }

  @Get('seo')
  @Can('marketing', 'view')
  seo() {
    return this.content.seo();
  }

  @Put('seo')
  @Can('marketing', 'edit')
  saveSeo(@Body() dto: SeoDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.content.saveSeo(dto, actorOf(user, req));
  }

  @Get('seo/sitemap')
  @Can('marketing', 'view')
  sitemap() {
    return this.content.sitemapStats();
  }

  @Get('redirects')
  @Can('marketing', 'view')
  redirects() {
    return this.content.redirects();
  }

  @Post('redirects')
  @Can('marketing', 'edit')
  addRedirect(@Body() dto: RedirectDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.content.addRedirect(dto, actorOf(user, req));
  }

  @Delete('redirects/:id')
  @Can('marketing', 'edit')
  removeRedirect(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.content.removeRedirect(id, actorOf(user, req));
  }

  @Get('pages')
  @Can('marketing', 'view')
  pages() {
    return this.content.pages();
  }

  @Get('pages/:id')
  @Can('marketing', 'view')
  page(@Param('id', ParseUUIDPipe) id: string) {
    return this.content.page(id);
  }

  @Post('pages')
  @Can('marketing', 'create')
  createPage(@Body() dto: PageDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.content.createPage(dto, actorOf(user, req));
  }

  @Patch('pages/:id')
  @Can('marketing', 'edit')
  updatePage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePageDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.content.updatePage(id, dto, actorOf(user, req));
  }
}
