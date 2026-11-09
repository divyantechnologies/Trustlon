import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CategoryNode {
  slug: string;
  name: string;
  nameHi: string | null;
  image: string | null;
  children: Array<{ slug: string; name: string; nameHi: string | null }>;
}

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Top-level categories with their sub-categories, in display order. */
  async tree(): Promise<CategoryNode[]> {
    const roots = await this.prisma.category.findMany({
      where: { parentId: null, isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { slug: true, name: true, nameHi: true },
        },
      },
    });
    return roots.map((root) => ({
      slug: root.slug,
      name: root.name,
      nameHi: root.nameHi,
      image: root.imageUrl,
      children: root.children,
    }));
  }

  async bySlug(slug: string) {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      include: {
        parent: { select: { slug: true, name: true, nameHi: true } },
        children: {
          where: { isActive: true },
          orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          select: { slug: true, name: true, nameHi: true },
        },
      },
    });
    if (!category) throw new NotFoundException('Category not found');

    return {
      slug: category.slug,
      name: category.name,
      nameHi: category.nameHi,
      image: category.imageUrl,
      parent: category.parent,
      children: category.children,
      breadcrumb: [
        ...(category.parent ? [{ slug: category.parent.slug, name: category.parent.name }] : []),
        { slug: category.slug, name: category.name },
      ],
    };
  }

  /** The category and its active sub-categories, for product filtering. Null if not found. */
  async idsWithChildren(slug: string): Promise<string[] | null> {
    const category = await this.prisma.category.findFirst({
      where: { slug, isActive: true },
      select: { id: true, children: { where: { isActive: true }, select: { id: true } } },
    });
    if (!category) return null;
    return [category.id, ...category.children.map((child) => child.id)];
  }
}
