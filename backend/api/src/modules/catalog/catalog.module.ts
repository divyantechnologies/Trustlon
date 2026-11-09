import { Module } from '@nestjs/common';
import { CatalogController } from './catalog.controller';
import { CategoriesService } from './categories.service';
import { PricingService } from './pricing.service';
import { ProductsService } from './products.service';
import { SearchService } from './search.service';

@Module({
  controllers: [CatalogController],
  providers: [CategoriesService, ProductsService, PricingService, SearchService],
  exports: [CategoriesService, ProductsService, PricingService],
})
export class CatalogModule {}
