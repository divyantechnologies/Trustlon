import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MarketingModule } from '../marketing/marketing.module';
import { ShoppingModule } from '../shopping/shopping.module';
import { StoresModule } from '../stores/stores.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [CatalogModule, StoresModule, ShoppingModule, MarketingModule],
  controllers: [HomeController],
  providers: [HomeService, RecommendationsService],
})
export class HomeModule {}
