import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { ProductQueryDto, SuggestQueryDto } from './dto/product-query.dto';
import { ProductsService } from './products.service';
import { SearchService } from './search.service';

@Controller()
export class CatalogController {
  constructor(
    private readonly categories: CategoriesService,
    private readonly products: ProductsService,
    private readonly search: SearchService,
  ) {}

  @Get('categories')
  @Header('Cache-Control', 'public, max-age=300')
  async categoryTree() {
    return { items: await this.categories.tree() };
  }

  @Get('categories/:slug')
  @Header('Cache-Control', 'public, max-age=300')
  category(@Param('slug') slug: string) {
    return this.categories.bySlug(slug);
  }

  /** Product listing for category, store, deals, originals and search pages. */
  @Get('products')
  listProducts(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }
  
    /** Filter options and counts for a listing page; accepts the same scope keys as /products. */
  @Get('products/facets')
  @Header('Cache-Control', 'public, max-age=60')
  facets(@Query() query: ProductQueryDto) {
    return this.products.facets(query);
  }
  
  /** Bounded lookup for data-driven related-product rails. Hidden products are omitted. */
  @Get('products/by-ids')
  async productsByIds(@Query('ids') ids?: string) {
    const requested = typeof ids === 'string' ? [...new Set(ids.split(',').filter(id => /^[a-zA-Z0-9_-]{1,100}$/.test(id)))].slice(0, 30) : [];
    return { items: await this.products.byIds(requested) };
  }

  @Get('products/:slug')
  product(@Param('slug') slug: string) {
    return this.products.detail(slug);
  }

  @Get('search')
  searchProducts(@Query() query: ProductQueryDto) {
    return this.products.list(query);
  }

  @Get('search/suggest')
  suggest(@Query() query: SuggestQueryDto) {
    return this.search.suggest(query.q);
  }
}
