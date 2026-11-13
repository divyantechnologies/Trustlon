import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CategoriesService } from './categories.service';
import { ProductQueryDto, ProductSort } from './dto/product-query.dto';
import { correctWords, queryWords } from './search-text';

// Read current relational fields, not the manually maintained search_text column.
const documents = Prisma.sql`
  SELECT p.*, c.slug AS category_slug, c.parent_id, v.slug AS store_slug,
    v.is_platform_owned,
    lower(concat_ws(' ', p.name, p.description, p.brand, c.name, c.name_hi, parent.name, parent.name_hi, v.display_name)) AS text,
    setweight(to_tsvector('english', p.name), 'A') ||
    setweight(to_tsvector('english', concat_ws(' ', p.brand, c.name, c.name_hi, parent.name, parent.name_hi)), 'B') ||
    setweight(to_tsvector('english', v.display_name), 'C') ||
    setweight(to_tsvector('english', coalesce(p.description, '')), 'D') AS document
  FROM products p JOIN categories c ON c.id = p.category_id JOIN vendors v ON v.id = p.vendor_id
  LEFT JOIN categories parent ON parent.id = c.parent_id AND parent.is_active = TRUE
  WHERE p.status = 'LIVE' AND p.deleted_at IS NULL AND v.status = 'ACTIVE' AND v.deleted_at IS NULL`;

function matches(query: string): Prisma.Sql {
  const words = queryWords(query);
  if (!words.length) return Prisma.sql`FALSE`;
  return Prisma.join(
    words.map(
      (word) => Prisma.sql`(
    document @@ plainto_tsquery('english', ${word}) OR strpos(text, ${word}) > 0
  )`,
    ),
    ' AND ',
  );
}

const order: Record<ProductSort, Prisma.Sql> = {
  relevance: Prisma.sql`score DESC, sales_count DESC, id ASC`,
  popularity: Prisma.sql`sales_count DESC, rating_count DESC, id ASC`,
  price_asc: Prisma.sql`price_paise ASC, id ASC`,
  price_desc: Prisma.sql`price_paise DESC, id ASC`,
  newest: Prisma.sql`created_at DESC, id ASC`,
  rating: Prisma.sql`rating_avg DESC, rating_count DESC, id ASC`,
};

@Injectable()
export class ProductSearchService {
  private vocabulary?: { expires: number; words: string[] };

  constructor(
    private readonly prisma: PrismaService,
    private readonly categories: CategoriesService,
  ) {}

  private async hasMatches(query: string): Promise<boolean> {
    const [row] = await this.prisma.$queryRaw<Array<{ found: boolean }>>(Prisma.sql`
      WITH documents AS (${documents})
      SELECT EXISTS(SELECT 1 FROM documents WHERE ${matches(query)}) AS found`);
    return row.found;
  }

  private async words(): Promise<string[]> {
    if (this.vocabulary && this.vocabulary.expires > Date.now()) return this.vocabulary.words;
    // Only a vocabulary crosses the wire, never the full catalog or customer data.
    const rows = await this.prisma.$queryRaw<Array<{ word: string }>>(Prisma.sql`
      SELECT word FROM products p
      JOIN categories c ON c.id = p.category_id JOIN vendors v ON v.id = p.vendor_id
      LEFT JOIN categories parent ON parent.id = c.parent_id AND parent.is_active = TRUE
      CROSS JOIN LATERAL unnest(tsvector_to_array(to_tsvector('simple',
        concat_ws(' ', p.name, p.description, p.brand, c.name, c.name_hi, parent.name, parent.name_hi, v.display_name)))) AS words(word)
      WHERE p.status = 'LIVE' AND p.deleted_at IS NULL AND v.status = 'ACTIVE'
        AND v.deleted_at IS NULL AND length(word) BETWEEN 3 AND 40
      GROUP BY word ORDER BY count(*) DESC, word ASC`);
    const words = rows.map((row) => row.word);
    this.vocabulary = { words, expires: Date.now() + 60_000 };
    return words;
  }

  async find(query: ProductQueryDto) {
    const originalQuery = (query.q ?? '').trim();
    let effectiveQuery = originalQuery;
    // Correct only zero-match queries across the catalog, not queries emptied by filters.
    if (
      query.autocorrect !== false &&
      queryWords(originalQuery).length &&
      !(await this.hasMatches(originalQuery))
    ) {
      const candidate = correctWords(queryWords(originalQuery), await this.words());
      if (candidate !== queryWords(originalQuery).join(' ') && (await this.hasMatches(candidate))) {
        effectiveQuery = candidate;
      }
    }

    const filters: Prisma.Sql[] = [matches(effectiveQuery)];
    if (query.category) {
      const ids = await this.categories.idsWithChildren(query.category);
      filters.push(
        ids?.length
          ? Prisma.sql`category_id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))})`
          : Prisma.sql`FALSE`,
      );
    }
    if (query.store) filters.push(Prisma.sql`store_slug = ${query.store}`);
    if (query.originals) filters.push(Prisma.sql`is_platform_owned = TRUE`);
    if (query.bundle) filters.push(Prisma.sql`is_bundle = TRUE`);
    if (query.inStock) filters.push(Prisma.sql`stock > 0`);
    if (query.minPricePaise !== undefined)
      filters.push(Prisma.sql`price_paise >= ${query.minPricePaise}`);
    if (query.maxPricePaise !== undefined)
      filters.push(Prisma.sql`price_paise <= ${query.maxPricePaise}`);
    if (query.deals) {
      const now = new Date();
      filters.push(Prisma.sql`EXISTS (SELECT 1 FROM deals WHERE product_id = documents.id
        AND starts_at <= ${now} AND ends_at > ${now})`);
    }
    const [result] = await this.prisma.$queryRaw<
      Array<{ total: bigint; ids: string[] }>
    >(Prisma.sql`
      WITH documents AS (${documents}), matched AS (
        SELECT id, price_paise, sales_count, rating_count, rating_avg, created_at,
          ts_rank(document, plainto_tsquery('english', ${effectiveQuery})) +
          CASE WHEN lower(name) = lower(${effectiveQuery}) THEN 2.0
            WHEN strpos(lower(name), lower(${effectiveQuery})) > 0 THEN 1.0 ELSE 0 END AS score
        FROM documents WHERE ${Prisma.join(filters, ' AND ')}
      )
      SELECT (SELECT count(*) FROM matched) AS total,
        ARRAY(SELECT id FROM matched ORDER BY ${order[query.sort]}
          LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}) AS ids`);
    return {
      ids: result.ids,
      total: Number(result.total),
      search: { originalQuery, query: effectiveQuery, corrected: effectiveQuery !== originalQuery },
    };
  }
}
