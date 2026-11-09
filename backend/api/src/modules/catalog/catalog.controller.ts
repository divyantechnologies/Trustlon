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
