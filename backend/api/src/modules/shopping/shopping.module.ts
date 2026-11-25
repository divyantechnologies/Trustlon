import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { CartService } from './cart.service';
import { RecentlyViewedService } from './recently-viewed.service';
import { CartController, RecentlyViewedController, WishlistController } from './shopping.controller';
import { ShoppingListener } from './shopping.listener';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CatalogModule],
  controllers: [CartController, RecentlyViewedController, WishlistController],
  providers: [CartService, WishlistService, RecentlyViewedService, ShoppingListener],
  exports: [CartService, RecentlyViewedService],
})
export class ShoppingModule {}
