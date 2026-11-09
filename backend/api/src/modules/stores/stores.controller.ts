import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import { LocalQueryDto } from './dto';
import { StoresService } from './stores.service';

@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  /** `featured=true` for the home page section; otherwise all verified stores. */
  @Get('stores')
  @Header('Cache-Control', 'public, max-age=300')
  async list(@Query('featured') featured?: string) {
    return { items: featured === 'true' ? await this.stores.featured() : await this.stores.verified() };
  }

  /** Brand Store header. Products come from GET /products?store=<slug>. */
  @Get('stores/:slug')
  @Header('Cache-Control', 'public, max-age=300')
  store(@Param('slug') slug: string) {
    return this.stores.bySlug(slug);
  }

  @Get('local/sellers')
  localSellers(@Query() query: LocalQueryDto) {
    return this.stores.localSellers(query.pincode, query.radiusKm);
  }

  @Get('local/products')
  async localProducts(@Query() query: LocalQueryDto) {
    return { items: await this.stores.localProducts(query.pincode, query.radiusKm) };
  }
}
