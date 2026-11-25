import { Module } from '@nestjs/common';
import { LocationModule } from '../location/location.module';
import { CatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { PricingService } from './pricing.service';
import { ProductsService } from './products.service';
import { SearchService } from './search.service';
import { ProductSearchService } from './product-search.service';

@Module({
  imports: [LocationModule],
  controllers: [CatalogController],
  providers: [
    CategoriesService,
    ProductsService,
    PricingService,
    SearchService,
    ProductSearchService,
  ],
  exports: [CategoriesService, ProductsService, PricingService],
})
export class CatalogModule {}
