import { BadRequestException, Controller, Get, Header, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LocalQueryDto } from './dto';
import { StoresService } from './stores.service';

@Controller()
export class StoresController {
  constructor(private readonly stores: StoresService) {}

  /** `featured=true` for the home page section; otherwise all verified stores. */
  @Get('stores')
  @Header('Cache-Control', 'public, max-age=300')
  async list(@Query('featured') featured?: string) {
    return {
      items: featured === 'true' ? await this.stores.featured() : await this.stores.verified(),
    };
  }

  /** Brand Store header. Products come from GET /products?store=<slug>. */
  @Get('stores/:slug')
  @Header('Cache-Control', 'public, max-age=300')
  store(@Param('slug') slug: string) {
    return this.stores.bySlug(slug);
  }

  @Get('local/sellers')
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  localSellers(@Query() query: LocalQueryDto) {
    return this.stores.localSellers(query.pincode, this.radius(query), query.page, query.pageSize);
  }

  @Get('local/products')
  @Header('Cache-Control', 'public, max-age=0, must-revalidate')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async localProducts(@Query() query: LocalQueryDto) {
    return this.stores.localProducts(query.pincode, this.radius(query), query.page, query.pageSize);
  }

  private radius(query: LocalQueryDto) {
    if (
      query.radius !== undefined &&
      query.radiusKm !== undefined &&
      query.radius !== query.radiusKm
    ) {
      throw new BadRequestException('radius and radiusKm must agree');
    }
    return query.radius ?? query.radiusKm ?? 10;
  }
}
