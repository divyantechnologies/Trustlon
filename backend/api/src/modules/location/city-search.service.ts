import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Lower-case ASCII form used for matching, so "Zürich" is found by "zur". */
export const searchKey = (value: string) =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

@Injectable()
export class CitySearchService {
  constructor(private readonly prisma: PrismaService) {}

  /** Largest matching cities first. Empty until GeoNames data is imported. */
  async search(countryCode: string, query: string): Promise<string[]> {
    const q = searchKey(query);
    if (q.length < 2) return [];
    const rows = await this.prisma.city.findMany({
      where: { countryCode, searchName: { startsWith: q } },
      orderBy: { population: 'desc' },
      distinct: ['name'],
      select: { name: true },
      take: 8,
    });
    return rows.map((row) => row.name);
  }
}
