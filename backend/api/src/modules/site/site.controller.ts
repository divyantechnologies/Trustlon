import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { Language, ProductStatus, SeoEntity, VendorStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import type { Response } from 'express';
import { FileStorage } from '../../common/storage/file-storage';
import { PrismaService } from '../../prisma/prisma.service';
import { SiteSettingsService } from './site-settings.service';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

class LanguageParam {
  @Transform(upper)
  @IsEnum(Language)
  language!: Language;
}

class SeoQuery {
  @Transform(upper)
  @IsEnum(SeoEntity)
  entity!: SeoEntity;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  key = 'home';
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ASSET_NAME = /^[a-z]+-[a-f0-9]{16}\.(png|jpg|webp)$/;
const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

/** Public, cacheable site data read by storefront pages: config, text, CMS pages, SEO. */
@Controller('site')
export class SiteController {
  constructor(
    private readonly settings: SiteSettingsService,
    private readonly storage: FileStorage,
    private readonly prisma: PrismaService,
  ) {}

  @Get('config')
  @Header('Cache-Control', 'public, max-age=30')
  config() {
    return this.settings.publicConfig();
  }

  @Get('content/:language')
  @Header('Cache-Control', 'public, max-age=30')
  async content(@Param() params: LanguageParam) {
    return { entries: await this.settings.content(params.language) };
  }

  /** Images uploaded from the admin panel: logo, banners, SEO share images. */
  @Get('assets/:name')
  async asset(@Param('name') name: string, @Res({ passthrough: true }) res: Response) {
    if (!ASSET_NAME.test(name)) throw new BadRequestException('Unknown file');
    const content = await this.storage.read(`site/${name}`);
    res.set({
      'Content-Type': CONTENT_TYPES[name.split('.').pop() as string],
      // File names are unique per upload, so they can be cached for a long time.
      'Cache-Control': 'public, max-age=31536000, immutable',
    });
    return new StreamableFile(content);
  }

  /** A published CMS page (About, Terms, Privacy, Returns policy…). */
  @Get('pages/:slug')
  @Header('Cache-Control', 'public, max-age=60')
  async page(@Param('slug') slug: string) {
    if (!SLUG.test(slug)) throw new NotFoundException('Page not found');
    const page = await this.prisma.cmsPage.findFirst({
      where: { slug, isPublished: true },
      select: { slug: true, title: true, body: true, updatedAt: true },
    });
    if (!page) throw new NotFoundException('Page not found');
    const seo = await this.prisma.seoMeta.findUnique({
      where: { entity_entityKey: { entity: SeoEntity.PAGE, entityKey: slug } },
    });
    return { ...page, seo: seo ? seoView(seo) : null };
  }

  @Get('seo')
  @Header('Cache-Control', 'public, max-age=60')
  async seo(@Query() query: SeoQuery) {
    const row = await this.prisma.seoMeta.findUnique({
      where: { entity_entityKey: { entity: query.entity, entityKey: query.key } },
    });
    return { seo: row ? seoView(row) : null };
  }

  /** Redirects for the storefront middleware, as { "/old": { to, permanent } }. */
  @Get('redirects')
  @Header('Cache-Control', 'public, max-age=60')
  async redirects() {
    const rows = await this.prisma.redirect.findMany({
      select: { fromPath: true, toPath: true, permanent: true },
    });
    return {
      redirects: Object.fromEntries(
        rows.map((row) => [row.fromPath, { to: row.toPath, permanent: row.permanent }]),
      ),
    };
  }

  /** Paths for sitemap.xml: categories, live products, stores and pages. */
  @Get('sitemap')
  @Header('Cache-Control', 'public, max-age=600')
  async sitemap() {
    const [categories, products, stores, pages, hidden] = await Promise.all([
      this.prisma.category.findMany({
        where: { isActive: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.product.findMany({
        where: {
          status: ProductStatus.LIVE,
          deletedAt: null,
          vendor: { status: VendorStatus.ACTIVE, deletedAt: null },
        },
        select: { slug: true, updatedAt: true },
        orderBy: { salesCount: 'desc' },
        take: 40_000,
      }),
      this.prisma.vendor.findMany({
        where: { status: VendorStatus.ACTIVE, deletedAt: null },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.cmsPage.findMany({
        where: { isPublished: true },
        select: { slug: true, updatedAt: true },
      }),
      this.prisma.seoMeta.findMany({
        where: { noIndex: true },
        select: { entity: true, entityKey: true },
      }),
    ]);
    const skip = new Set(hidden.map((row) => `${row.entity}:${row.entityKey}`));
    return {
      urls: [
        { path: '/', updatedAt: null },
        ...categories
          .filter((c) => !skip.has(`CATEGORY:${c.slug}`))
          .map((c) => ({ path: `/c/${c.slug}`, updatedAt: c.updatedAt })),
        ...products.map((p) => ({ path: `/p/${p.slug}`, updatedAt: p.updatedAt })),
        ...stores.map((s) => ({ path: `/store/${s.slug}`, updatedAt: s.updatedAt })),
        ...pages
          .filter((p) => !skip.has(`PAGE:${p.slug}`))
          .map((p) => ({ path: `/pages/${p.slug}`, updatedAt: p.updatedAt })),
      ],
    };
  }
}

function seoView(row: {
  title: string | null;
  description: string | null;
  keywords: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
}) {
  return {
    title: row.title,
    description: row.description,
    keywords: row.keywords,
    ogImageUrl: row.ogImageUrl,
    noIndex: row.noIndex,
  };
}
