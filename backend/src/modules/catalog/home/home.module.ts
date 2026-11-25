import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog.module';
import { MarketingModule } from '../marketing/marketing.module';
import { ShoppingModule } from '../../orders/cart/shopping.module';
import { StoresModule } from '../../partners/stores/stores.module';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { RecommendationsService } from './recommendations.service';

@Module({
  imports: [CatalogModule, StoresModule, ShoppingModule, MarketingModule],
  controllers: [HomeController],
  providers: [HomeService, RecommendationsService],
})
export class HomeModule {}
