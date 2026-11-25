import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma } from '@prisma/client';
import { Actor, AuditService } from '../../../middlewares/admin/audit.service';
import { PrismaService } from '../../../database/prisma.service';
import { istToday } from '../shared';
import {
  AttributeDto,
  CategoryAttributesDto,
  CategoryDto,
  HsnDto,
  HsnQuery,
  MAX_CATEGORY_DEPTH,
  ReorderDto,
  UpdateAttributeDto,
  UpdateCategoryDto,
} from './dto';

/** Fired so cached category menus and filters refresh. */
export const CATALOG_CHANGED = 'catalog.changed';

const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'category';

interface Node {
  id: string;
  parentId: string | null;
}

/** Depth of each category (top level = 1) and the deepest level under it. */
function treeShape(nodes: Node[]) {
  const children = new Map<string | null, string[]>();
  for (const node of nodes)
    children.set(node.parentId, [...(children.get(node.parentId) ?? []), node.id]);
  const depth = new Map<string, number>();
  const height = new Map<string, number>();
  const visit = (id: string, level: number, seen: Set<string>): number => {
    if (seen.has(id)) throw new BadRequestException('A category can’t be placed inside itself');
    seen.add(id);
    depth.set(id, level);
    let below = 0;
    for (const child of children.get(id) ?? [])
      below = Math.max(below, visit(child, level + 1, seen) + 1);
    height.set(id, below);
    return below;
  };
  const seen = new Set<string>();
  for (const root of children.get(null) ?? []) visit(root, 1, seen);
  if (seen.size !== nodes.length)
    throw new BadRequestException('A category can’t be placed inside itself');
  return { depth, height };
}

/** Categories, attributes and the HSN master (5.3). */
@Injectable()
export class AdminCatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly events: EventEmitter2,
  ) {}

  /* Categories */

  async categories() {
    const [rows, counts] = await Promise.all([
      this.prisma.category.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
        include: { _count: { select: { attributes: true, children: true } } },
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: { deletedAt: null },
        _count: { _all: true },
      }),
    ]);
    const products = new Map(counts.map((row) => [row.categoryId, row._count._all]));
    const { depth } = treeShape(rows);
    return {
      maxDepth: MAX_CATEGORY_DEPTH,
      items: rows.map((row) => ({
        id: row.id,
        name: row.name,
        nameHi: row.nameHi,
        slug: row.slug,
        description: row.description,
        parentId: row.parentId,
        sortOrder: row.sortOrder,
        depth: depth.get(row.id) ?? 1,
        imageUrl: row.imageUrl,
        defaultHsn: row.defaultHsn,
        commissionPercent: row.commissionBps === null ? null : row.commissionBps / 100,
        returnWindowDays: row.returnWindowDays,
        moderationRequired: row.moderationRequired,
        codAllowed: row.codAllowed,
        isActive: row.isActive,
        products: products.get(row.id) ?? 0,
        attributes: row._count.attributes,
        children: row._count.children,
      })),
    };
  }

  async createCategory(dto: CategoryDto, actor: Actor) {
    if (dto.parentId) await this.assertParent(dto.parentId, null);
    const slug = await this.uniqueSlug(dto.slug ?? slugify(dto.name));
    const last = await this.prisma.category.aggregate({
      where: { parentId: dto.parentId ?? null },
      _max: { sortOrder: true },
    });
    const created = await this.prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: {
          name: dto.name,
          nameHi: dto.nameHi || null,
          slug,
          description: dto.description || null,
          parentId: dto.parentId ?? null,
          imageUrl: dto.imageUrl ?? null,
          defaultHsn: dto.defaultHsn || null,
          commissionBps:
            dto.commissionPercent === undefined || dto.commissionPercent === null
              ? null
              : Math.round(dto.commissionPercent * 100),
          returnWindowDays: dto.returnWindowDays ?? 7,
          moderationRequired: dto.moderationRequired ?? true,
          codAllowed: dto.codAllowed ?? true,
          isActive: dto.isActive ?? true,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'category.create',
          entity: 'category',
          entityId: category.id,
          summary: category.name,
          after: dto,
        },
        tx,
      );
      return category;
    });
    this.events.emit(CATALOG_CHANGED);
    return { id: created.id };
  }

  async updateCategory(id: string, dto: UpdateCategoryDto, actor: Actor) {
    const before = await this.prisma.category.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Category not found');
    if (dto.parentId !== undefined && dto.parentId !== before.parentId)
      await this.assertParent(dto.parentId, id);
    const data: Prisma.CategoryUncheckedUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.nameHi !== undefined ? { nameHi: dto.nameHi || null } : {}),
      ...(dto.slug !== undefined && dto.slug !== before.slug
        ? { slug: await this.uniqueSlug(dto.slug, id) }
        : {}),
      ...(dto.description !== undefined ? { description: dto.description || null } : {}),
      ...(dto.parentId !== undefined ? { parentId: dto.parentId } : {}),
      ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl } : {}),
      ...(dto.defaultHsn !== undefined ? { defaultHsn: dto.defaultHsn || null } : {}),
      ...(dto.commissionPercent !== undefined
        ? {
            commissionBps:
              dto.commissionPercent === null ? null : Math.round(dto.commissionPercent * 100),
          }
        : {}),
      ...(dto.returnWindowDays !== undefined ? { returnWindowDays: dto.returnWindowDays } : {}),
      ...(dto.moderationRequired !== undefined
        ? { moderationRequired: dto.moderationRequired }
        : {}),
      ...(dto.codAllowed !== undefined ? { codAllowed: dto.codAllowed } : {}),
      ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
    };
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.category.update({ where: { id }, data });
      await this.audit.log(
        actor,
        {
          action: 'category.update',
          entity: 'category',
          entityId: id,
          summary: after.name,
          before: pick(before, Object.keys(data)),
          after: pick(after, Object.keys(data)),
        },
        tx,
      );
    });
    this.events.emit(CATALOG_CHANGED);
    return { id };
  }

  /** Saves a drag-and-drop arrangement: parents and order for many categories at once. */
  async reorder(dto: ReorderDto, actor: Actor) {
    const rows = await this.prisma.category.findMany({
      select: { id: true, parentId: true, sortOrder: true },
    });
    const byId = new Map(rows.map((row) => [row.id, { ...row }]));
    for (const item of dto.items) {
      const row = byId.get(item.id);
      if (!row) throw new NotFoundException('Category not found');
      if (item.parentId && !byId.has(item.parentId))
        throw new NotFoundException('Parent category not found');
      row.parentId = item.parentId;
      row.sortOrder = item.sortOrder;
    }
    const { depth } = treeShape([...byId.values()]);
    if ([...depth.values()].some((level) => level > MAX_CATEGORY_DEPTH)) {
      throw new BadRequestException(`Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep`);
    }
    const changed = dto.items.filter((item) => {
      const old = rows.find((row) => row.id === item.id);
      return old && (old.parentId !== item.parentId || old.sortOrder !== item.sortOrder);
    });
    await this.prisma.$transaction(async (tx) => {
      for (const item of changed) {
        await tx.category.update({
          where: { id: item.id },
          data: { parentId: item.parentId, sortOrder: item.sortOrder },
        });
      }
      await this.audit.log(
        actor,
        {
          action: 'category.reorder',
          entity: 'category',
          summary: `${changed.length} categories moved`,
          after: changed,
        },
        tx,
      );
    });
    this.events.emit(CATALOG_CHANGED);
    return this.categories();
  }

  async deleteCategory(id: string, actor: Actor) {
    const category = await this.prisma.category.findUnique({
      where: { id },
      include: { _count: { select: { children: true, products: true } } },
    });
    if (!category) throw new NotFoundException('Category not found');
    if (category._count.children || category._count.products) {
      throw new ConflictException(
        'Move its sub-categories and products first, or turn the category off instead',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.category.delete({ where: { id } });
      await this.audit.log(
        actor,
        {
          action: 'category.delete',
          entity: 'category',
          entityId: id,
          summary: category.name,
          before: { name: category.name, slug: category.slug },
        },
        tx,
      );
    });
    this.events.emit(CATALOG_CHANGED);
  }

  private async assertParent(parentId: string | null, movingId: string | null) {
    if (!parentId) return;
    const rows = await this.prisma.category.findMany({ select: { id: true, parentId: true } });
    if (!rows.some((row) => row.id === parentId))
      throw new NotFoundException('Parent category not found');
    const nodes = rows.map((row) => (row.id === movingId ? { ...row, parentId } : row));
    if (!movingId) nodes.push({ id: '__new__', parentId });
    const { depth } = treeShape(nodes);
    if ([...depth.values()].some((level) => level > MAX_CATEGORY_DEPTH)) {
      throw new BadRequestException({
        statusCode: 400,
        message: `Categories can be at most ${MAX_CATEGORY_DEPTH} levels deep`,
        field: 'parentId',
      });
    }
  }

  private async uniqueSlug(base: string, exceptId?: string): Promise<string> {
    for (let i = 0; i < 50; i += 1) {
      const slug = i === 0 ? base : `${base.slice(0, 75)}-${i + 1}`;
      const clash = await this.prisma.category.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!clash || clash.id === exceptId) return slug;
    }
    throw new ConflictException({
      statusCode: 409,
      message: 'Choose a different URL name',
      field: 'slug',
    });
  }

  /* Attributes */

  async attributes() {
    const rows = await this.prisma.attribute.findMany({
      orderBy: { name: 'asc' },
      include: { categories: { select: { categoryId: true } } },
    });
    return {
      items: rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        unit: row.unit,
        options: row.options,
        isFilterable: row.isFilterable,
        isVariant: row.isVariant,
        categoryIds: row.categories.map((c) => c.categoryId),
      })),
    };
  }

  async createAttribute(dto: AttributeDto, actor: Actor) {
    const code = dto.code ?? slugify(dto.name).replace(/-/g, '_').slice(0, 40);
    if (await this.prisma.attribute.findUnique({ where: { code } })) {
      throw new ConflictException({
        statusCode: 409,
        message: 'An attribute with this code already exists',
        field: 'code',
      });
    }
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.attribute.create({
        data: {
          code,
          name: dto.name,
          type: dto.type,
          unit: dto.unit || null,
          options: cleanOptions(dto.options),
          isFilterable: dto.isFilterable ?? false,
          isVariant: dto.isVariant ?? false,
        },
      });
      await this.audit.log(
        actor,
        {
          action: 'attribute.create',
          entity: 'attribute',
          entityId: row.id,
          summary: row.name,
          after: dto,
        },
        tx,
      );
      return row;
    });
    this.events.emit(CATALOG_CHANGED);
    return { id: created.id };
  }

  async updateAttribute(id: string, dto: UpdateAttributeDto, actor: Actor) {
    const before = await this.prisma.attribute.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Attribute not found');
    const data: Prisma.AttributeUpdateInput = {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.type !== undefined ? { type: dto.type } : {}),
      ...(dto.unit !== undefined ? { unit: dto.unit || null } : {}),
      ...(dto.options !== undefined ? { options: cleanOptions(dto.options) } : {}),
      ...(dto.isFilterable !== undefined ? { isFilterable: dto.isFilterable } : {}),
      ...(dto.isVariant !== undefined ? { isVariant: dto.isVariant } : {}),
    };
    await this.prisma.$transaction(async (tx) => {
      const after = await tx.attribute.update({ where: { id }, data });
      await this.audit.log(
        actor,
        {
          action: 'attribute.update',
          entity: 'attribute',
          entityId: id,
          summary: after.name,
          before: pick(before, Object.keys(data)),
          after: pick(after, Object.keys(data)),
        },
        tx,
      );
    });
    this.events.emit(CATALOG_CHANGED);
    return { id };
  }

  async categoryAttributes(categoryId: string) {
    const rows = await this.prisma.categoryAttribute.findMany({
      where: { categoryId },
      orderBy: { sortOrder: 'asc' },
      include: { attribute: { select: { id: true, name: true, code: true, type: true } } },
    });
    return {
      items: rows.map((row) => ({
        attributeId: row.attributeId,
        isRequired: row.isRequired,
        sortOrder: row.sortOrder,
        attribute: row.attribute,
      })),
    };
  }

  async setCategoryAttributes(categoryId: string, dto: CategoryAttributesDto, actor: Actor) {
    const category = await this.prisma.category.findUnique({
      where: { id: categoryId },
      select: { name: true },
    });
    if (!category) throw new NotFoundException('Category not found');
    const ids = [...new Set(dto.items.map((item) => item.attributeId))];
    if ((await this.prisma.attribute.count({ where: { id: { in: ids } } })) !== ids.length) {
      throw new NotFoundException('Attribute not found');
    }
    const before = await this.prisma.categoryAttribute.findMany({ where: { categoryId } });
    await this.prisma.$transaction(async (tx) => {
      await tx.categoryAttribute.deleteMany({ where: { categoryId } });
      if (dto.items.length) {
        await tx.categoryAttribute.createMany({
          data: dto.items.map((item) => ({
            categoryId,
            attributeId: item.attributeId,
            isRequired: item.isRequired,
            sortOrder: item.sortOrder,
          })),
          skipDuplicates: true,
        });
      }
      await this.audit.log(
        actor,
        {
          action: 'category.attributes',
          entity: 'category',
          entityId: categoryId,
          summary: category.name,
          before,
          after: dto.items,
        },
        tx,
      );
    });
    this.events.emit(CATALOG_CHANGED);
    return this.categoryAttributes(categoryId);
  }

  /* HSN master: rates are versioned by effective date. */

  async hsn(query: HsnQuery) {
    const q = query.q?.trim();
    const rows = await this.prisma.hsnRate.findMany({
      where: q
        ? {
            OR: [
              { code: { startsWith: q.replace(/\s/g, '') } },
              { description: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'desc' }],
      take: 1000,
    });
    const today = istToday();
    const byCode = new Map<string, typeof rows>();
    for (const row of rows) byCode.set(row.code, [...(byCode.get(row.code) ?? []), row]);
    return {
      items: [...byCode.entries()].slice(0, 300).map(([code, versions]) => {
        const view = versions.map((v) => ({
          id: v.id,
          description: v.description,
          gstRatePercent: v.gstRateBps / 100,
          effectiveFrom: v.effectiveFrom.toISOString().slice(0, 10),
        }));
        const current = view.find((v) => v.effectiveFrom <= today) ?? null;
        const upcoming = view.filter((v) => v.effectiveFrom > today);
        return {
          code,
          description: (current ?? view[0]).description,
          current,
          upcoming,
          history: view.filter((v) => v !== current && v.effectiveFrom <= today),
        };
      }),
    };
  }

  /** Adds a code, or a new rate for an existing code from a future date. Past rates never change. */
  async addHsn(dto: HsnDto, actor: Actor) {
    const existing = await this.prisma.hsnRate.findMany({
      where: { code: dto.code },
      orderBy: { effectiveFrom: 'desc' },
    });
    if (existing.length && dto.effectiveFrom <= istToday()) {
      throw new BadRequestException({
        statusCode: 400,
        message: 'A new rate for an existing code must start from tomorrow or later',
        field: 'effectiveFrom',
      });
    }
    const effectiveFrom = new Date(`${dto.effectiveFrom}T00:00:00.000Z`);
    if (existing.some((row) => row.effectiveFrom.getTime() === effectiveFrom.getTime())) {
      throw new ConflictException({
        statusCode: 409,
        message: 'This code already has a rate from that date',
        field: 'effectiveFrom',
      });
    }
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.hsnRate.create({
        data: {
          code: dto.code,
          description: dto.description,
          gstRateBps: Math.round(dto.gstRatePercent * 100),
          effectiveFrom,
          createdById: actor.id,
        },
      });
      await this.audit.log(
        actor,
        {
          action: existing.length ? 'hsn.rate_change' : 'hsn.create',
          entity: 'hsn',
          entityId: row.id,
          summary: `HSN ${dto.code}`,
          before: existing[0] ? { gstRatePercent: existing[0].gstRateBps / 100 } : null,
          after: {
            gstRatePercent: dto.gstRatePercent,
            effectiveFrom: dto.effectiveFrom,
            description: dto.description,
          },
        },
        tx,
      );
    });
    return this.hsn({ q: dto.code });
  }

  /** A scheduled (future) rate can be withdrawn before it starts. */
  async removeHsn(id: string, actor: Actor) {
    const row = await this.prisma.hsnRate.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('HSN rate not found');
    if (row.effectiveFrom.toISOString().slice(0, 10) <= istToday()) {
      throw new ConflictException(
        'Rates already in effect can’t be removed; add a new rate instead',
      );
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.hsnRate.delete({ where: { id } });
      await this.audit.log(
        actor,
        {
          action: 'hsn.remove_scheduled',
          entity: 'hsn',
          entityId: id,
          summary: `HSN ${row.code}`,
          before: { gstRatePercent: row.gstRateBps / 100, effectiveFrom: row.effectiveFrom },
        },
        tx,
      );
    });
  }
}

function cleanOptions(options: string[] | undefined): string[] {
  return [...new Set((options ?? []).map((o) => o.trim()).filter(Boolean))];
}

function pick(row: object, keys: string[]): Record<string, unknown> {
  const source = row as Record<string, unknown>;
  return Object.fromEntries(keys.map((key) => [key, source[key]]));
}
