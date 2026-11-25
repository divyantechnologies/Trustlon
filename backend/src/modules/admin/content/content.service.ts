import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CouponType, Prisma, SeoEntity } from '@prisma/client';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { PrismaService } from '../../../database/prisma.service';
import { CouponDto, PageDto, RedirectDto, SeoDto, UpdateCouponDto, UpdatePageDto } from './dto';

/** Built-in CMS pages offered on first use (5.7). */
export const DEFAULT_PAGES = [
  { slug: 'about', title: 'About Trustlon' },
  { slug: 'terms', title: 'Terms of use' },
  { slug: 'privacy', title: 'Privacy policy' },
  { slug: 'returns-policy', title: 'Returns and refunds policy' },
  { slug: 'shipping-policy', title: 'Shipping policy' },
];

/** Coupons, SEO, redirects and CMS pages: the content side of Marketing (5.7). */
@Injectable()
export class AdminContentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /* Platform coupons (Trustlon-funded; never reduce the vendor's invoice value). */

  async coupons() {
    const rows = await this.prisma.coupon.findMany({
      orderBy: [{ isActive: 'desc' }, { endsAt: 'desc' }],
      take: 500,
    });
    const now = Date.now();
    return {
      items: rows.map((c) => ({
        ...c,
        state: !c.isActive
          ? 'off'
          : c.endsAt.getTime() < now
            ? 'ended'
            : c.startsAt.getTime() > now
              ? 'scheduled'
              : c.usageLimit !== null && c.usedCount >= c.usageLimit
                ? 'used_up'
                : 'live',
      })),
    };
  }

  async createCoupon(dto: CouponDto, actor: Actor) {
    if (await this.prisma.coupon.findUnique({ where: { code: dto.code } })) {
      throw new ConflictException({
        statusCode: 409,
        message: 'This code is already used',
        field: 'code',
      });
    }
    const data = {
      ...this.couponData(dto.type, dto, true),
      code: dto.code,
      type: dto.type,
    } as unknown as Prisma.CouponCreateInput;
    const coupon = await this.prisma.$transaction(async (tx) => {
      const row = await tx.coupon.create({ data });
      await this.audit.log(
        actor,
        {
          action: 'coupon.create',
          entity: 'coupon',
          entityId: row.id,
          summary: row.code,
          after: data,
        },
        tx,
      );
      return row;
    });
    return coupon;
  }

  async updateCoupon(id: string, dto: UpdateCouponDto, actor: Actor) {
    const before = await this.prisma.coupon.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Coupon not found');
    const data = this.couponData(
      before.type,
      { ...dto, startsAt: dto.startsAt ?? before.startsAt, endsAt: dto.endsAt ?? before.endsAt },
      false,
    );
    return this.prisma.$transaction(async (tx) => {
      const row = await tx.coupon.update({ where: { id }, data });
      await this.audit.log(
        actor,
        {
          action: 'coupon.update',
          entity: 'coupon',
          entityId: id,
          summary: row.code,
          before,
          after: data,
        },
        tx,
      );
      return row;
    });
  }

  private couponData(
    type: CouponType,
    dto: UpdateCouponDto,
    creating: boolean,
  ): Prisma.CouponUpdateInput {
    if (creating && (!dto.startsAt || !dto.endsAt)) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Choose when the coupon starts and ends',
        field: 'startsAt',
      });
    }
    if (dto.startsAt && dto.endsAt && dto.endsAt <= dto.startsAt) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'The end must be after the start',
        field: 'endsAt',
      });
    }
    if (dto.value !== undefined || creating) {
      const value = dto.value ?? 0;
      if (type === CouponType.PERCENT && (value < 100 || value > 9000)) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Percent coupons give 1% to 90% off',
          field: 'value',
        });
      }
      if (type === CouponType.FLAT && value < 100) {
        throw new BadRequestException({
          statusCode: 400,
          message: 'Enter the amount off',
          field: 'value',
        });
      }
    }
    if (creating && !dto.description) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'Describe the offer for customers',
        field: 'description',
      });
    }
    const data: Prisma.CouponUpdateInput = {};
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.value !== undefined || creating)
      data.value = type === CouponType.FREE_DELIVERY ? 0 : (dto.value ?? 0);
    if (dto.maxDiscountPaise !== undefined)
      data.maxDiscountPaise = type === CouponType.PERCENT ? dto.maxDiscountPaise : null;
    if (dto.minOrderPaise !== undefined) data.minOrderPaise = dto.minOrderPaise;
    if (dto.audience !== undefined) data.audience = dto.audience;
    if (dto.categoryIds !== undefined) data.categoryIds = dto.categoryIds;
    if (dto.usageLimit !== undefined) data.usageLimit = dto.usageLimit;
    if (dto.perUserLimit !== undefined) data.perUserLimit = dto.perUserLimit;
    if (dto.startsAt !== undefined) data.startsAt = dto.startsAt;
    if (dto.endsAt !== undefined) data.endsAt = dto.endsAt;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    return data;
  }

  /* SEO */

  async seo() {
    const [rows, categories, pages] = await Promise.all([
      this.prisma.seoMeta.findMany(),
      this.prisma.category.findMany({
        orderBy: [{ parentId: 'asc' }, { sortOrder: 'asc' }],
        select: { slug: true, name: true, isActive: true },
      }),
      this.prisma.cmsPage.findMany({ select: { slug: true, title: true, isPublished: true } }),
    ]);
    const saved = new Map(rows.map((row) => [`${row.entity}:${row.entityKey}`, row]));
    const entry = (entity: SeoEntity, key: string, label: string, path: string) => {
      const row = saved.get(`${entity}:${key}`);
      return {
        entity,
        entityKey: key,
        label,
        path,
        title: row?.title ?? null,
        description: row?.description ?? null,
        keywords: row?.keywords ?? null,
        ogImageUrl: row?.ogImageUrl ?? null,
        noIndex: row?.noIndex ?? false,
        updatedAt: row?.updatedAt ?? null,
      };
    };
    return {
      items: [
        entry(SeoEntity.HOME, 'home', 'Home page', '/'),
        ...categories.map((c) => entry(SeoEntity.CATEGORY, c.slug, c.name, `/c/${c.slug}`)),
        ...pages.map((p) => entry(SeoEntity.PAGE, p.slug, p.title, `/pages/${p.slug}`)),
      ],
    };
  }

  async saveSeo(dto: SeoDto, actor: Actor) {
    const exists =
      dto.entity === SeoEntity.HOME
        ? dto.entityKey === 'home'
        : dto.entity === SeoEntity.CATEGORY
          ? await this.prisma.category.count({ where: { slug: dto.entityKey } })
          : await this.prisma.cmsPage.count({ where: { slug: dto.entityKey } });
    if (!exists) throw new NotFoundException('Page not found');
    const data = {
      title: dto.title || null,
      description: dto.description || null,
      keywords: dto.keywords || null,
      ogImageUrl: dto.ogImageUrl || null,
      noIndex: dto.noIndex ?? false,
    };
    const before = await this.prisma.seoMeta.findUnique({
      where: { entity_entityKey: { entity: dto.entity, entityKey: dto.entityKey } },
    });
    await this.prisma.$transaction(async (tx) => {
      await tx.seoMeta.upsert({
        where: { entity_entityKey: { entity: dto.entity, entityKey: dto.entityKey } },
        create: { entity: dto.entity, entityKey: dto.entityKey, ...data },
        update: data,
      });
      await this.audit.log(
        actor,
        {
          action: 'seo.update',
          entity: 'seo',
          entityId: `${dto.entity}:${dto.entityKey}`,
          before,
          after: data,
        },
        tx,
      );
    });
    return this.seo();
  }

  /* Redirects */

  redirects() {
    return this.prisma.redirect
      .findMany({ orderBy: { createdAt: 'desc' } })
      .then((items) => ({ items }));
  }

  async addRedirect(dto: RedirectDto, actor: Actor) {
    if (dto.fromPath === dto.toPath)
      throw new BadRequestException({
        statusCode: 400,
        message: 'A page can’t redirect to itself',
        field: 'toPath',
      });
    if (dto.fromPath.startsWith('/api/') || dto.fromPath === '/') {
      throw new BadRequestException({
        statusCode: 400,
        message: 'This path can’t be redirected',
        field: 'fromPath',
      });
    }
    const loop = await this.prisma.redirect.findUnique({ where: { fromPath: dto.toPath } });
    if (loop?.toPath === dto.fromPath)
      throw new BadRequestException({
        statusCode: 400,
        message: 'This would create a redirect loop',
        field: 'toPath',
      });
    const row = await this.prisma.redirect.upsert({
      where: { fromPath: dto.fromPath },
      create: { fromPath: dto.fromPath, toPath: dto.toPath, permanent: dto.permanent ?? true },
      update: { toPath: dto.toPath, permanent: dto.permanent ?? true },
    });
    await this.audit.log(actor, {
      action: 'redirect.save',
      entity: 'redirect',
      entityId: row.id,
      summary: `${row.fromPath} → ${row.toPath}`,
      after: dto,
    });
    return this.redirects();
  }

  async removeRedirect(id: string, actor: Actor) {
    const row = await this.prisma.redirect.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Redirect not found');
    await this.prisma.redirect.delete({ where: { id } });
    await this.audit.log(actor, {
      action: 'redirect.delete',
      entity: 'redirect',
      entityId: id,
      summary: `${row.fromPath} → ${row.toPath}`,
      before: row,
    });
    return this.redirects();
  }

  /* CMS pages */

  async pages() {
    const rows = await this.prisma.cmsPage.findMany({ orderBy: { title: 'asc' } });
    const existing = new Set(rows.map((r) => r.slug));
    return {
      items: rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        isPublished: r.isPublished,
        publishedAt: r.publishedAt,
        updatedAt: r.updatedAt,
        length: r.body.length,
      })),
      suggestions: DEFAULT_PAGES.filter((p) => !existing.has(p.slug)),
    };
  }

  async page(id: string) {
    const row = await this.prisma.cmsPage.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Page not found');
    return row;
  }

  async createPage(dto: PageDto, actor: Actor) {
    if (await this.prisma.cmsPage.findUnique({ where: { slug: dto.slug } })) {
      throw new ConflictException({
        statusCode: 409,
        message: 'A page with this address already exists',
        field: 'slug',
      });
    }
    const now = new Date();
    const row = await this.prisma.cmsPage.create({
      data: {
        slug: dto.slug,
        title: dto.title,
        body: dto.body,
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? now : null,
        updatedById: actor.id,
      },
    });
    await this.audit.log(actor, {
      action: 'page.create',
      entity: 'page',
      entityId: row.id,
      summary: row.title,
      after: { slug: row.slug, isPublished: row.isPublished },
    });
    return row;
  }

  async updatePage(id: string, dto: UpdatePageDto, actor: Actor) {
    const before = await this.page(id);
    const publishing = dto.isPublished === true && !before.isPublished;
    const row = await this.prisma.cmsPage.update({
      where: { id },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.body !== undefined ? { body: dto.body } : {}),
        ...(dto.isPublished !== undefined ? { isPublished: dto.isPublished } : {}),
        ...(publishing ? { publishedAt: new Date() } : {}),
        updatedById: actor.id,
      },
    });
    await this.audit.log(actor, {
      action: publishing
        ? 'page.publish'
        : dto.isPublished === false && before.isPublished
          ? 'page.unpublish'
          : 'page.update',
      entity: 'page',
      entityId: id,
      summary: row.title,
      before: { title: before.title, isPublished: before.isPublished, length: before.body.length },
      after: { title: row.title, isPublished: row.isPublished, length: row.body.length },
    });
    return row;
  }

  /* Sitemap */

  async sitemapStats() {
    const [categories, products, stores, pages, noIndex] = await Promise.all([
      this.prisma.category.count({ where: { isActive: true } }),
      this.prisma.product.count({
        where: { status: 'LIVE', deletedAt: null, vendor: { status: 'ACTIVE' } },
      }),
      this.prisma.vendor.count({ where: { status: 'ACTIVE', deletedAt: null } }),
      this.prisma.cmsPage.count({ where: { isPublished: true } }),
      this.prisma.seoMeta.count({ where: { noIndex: true } }),
    ]);
    return { categories, products, stores, pages, hidden: noIndex, path: '/sitemap.xml' };
  }
}
