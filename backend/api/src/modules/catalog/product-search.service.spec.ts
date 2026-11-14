import 'reflect-metadata';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from './categories.service';
import { ProductQueryDto } from './dto/product-query.dto';
import { ProductSearchService } from './product-search.service';

describe('product search orchestration', () => {
  const raw = jest.fn();
  const idsWithChildren = jest.fn();
  let service: ProductSearchService;
  const dto = (overrides: Partial<ProductQueryDto> = {}) =>
    Object.assign(new ProductQueryDto(), { q: 'wireless', ...overrides });
  beforeEach(() => {
    raw.mockReset();
    idsWithChildren.mockReset();
    service = new ProductSearchService(
      { $queryRaw: raw } as unknown as PrismaService,
      { idsWithChildren } as unknown as CategoriesService,
    );
  });
  it('never corrects an existing search just because filters produce no results', async () => {
    raw.mockResolvedValueOnce([{ found: true }]).mockResolvedValueOnce([{ total: 0n, ids: [] }]);
    const result = await service.find(dto({ minPricePaise: 99999999 }));
    expect(result).toMatchObject({ total: 0, search: { query: 'wireless', corrected: false } });
    expect(raw).toHaveBeenCalledTimes(2);
  });
  it('corrects only a candidate confirmed by a real catalog match', async () => {
    raw
      .mockResolvedValueOnce([{ found: false }])
      .mockResolvedValueOnce([{ word: 'wireless' }, { word: 'headphones' }])
      .mockResolvedValueOnce([{ found: true }])
      .mockResolvedValueOnce([{ total: 1n, ids: ['product-id'] }]);
    expect(await service.find(dto({ q: 'wirless headphnoes' }))).toMatchObject({
      ids: ['product-id'],
      total: 1,
      search: {
        originalQuery: 'wirless headphnoes',
        query: 'wireless headphones',
        corrected: true,
      },
    });
  });
  it('keeps the original query when a corrected combination has no products', async () => {
    raw
      .mockResolvedValueOnce([{ found: false }])
      .mockResolvedValueOnce([{ word: 'wireless' }])
      .mockResolvedValueOnce([{ found: false }])
      .mockResolvedValueOnce([{ total: 0n, ids: [] }]);
    expect((await service.find(dto({ q: 'wirless' }))).search.corrected).toBe(false);
  });
  it('skips all correction queries when searching the original spelling', async () => {
    raw.mockResolvedValueOnce([{ total: 0n, ids: [] }]);
    await service.find(dto({ q: 'wirless', autocorrect: false }));
    expect(raw).toHaveBeenCalledTimes(1);
  });
  it('parameterizes user text and applies every supported filter before counting/paging', async () => {
    raw.mockResolvedValueOnce([{ total: 30n, ids: ['id'] }]);
    idsWithChildren.mockResolvedValue(['00000000-0000-0000-0000-000000000001']);
    const q = "wireless'; DROP TABLE products; --";
    await service.find(
      dto({
        q,
        autocorrect: false,
        category: 'audio',
        store: ['soundspace'],
        minPricePaise: 10,
        maxPricePaise: 500,
        inStock: true,
        deals: true,
        originals: true,
        bundle: true,
        sort: 'price_desc',
        page: 2,
        pageSize: 24,
      }),
    );
    const sql = raw.mock.calls[0][0] as Prisma.Sql;
    expect(sql.sql).not.toContain(q);
    expect(sql.values).toContain(q);
    expect(sql.sql).toContain('category_id IN');
    expect(sql.sql).toContain('stock > 0');
    expect(sql.sql).toContain('starts_at <=');
    expect(sql.sql).toContain('price_paise DESC, id ASC');
    expect(sql.values.slice(-2)).toEqual([24, 24]);
    expect(idsWithChildren).toHaveBeenCalledWith('audio');
  });
});
