import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AdminCommonModule } from './middlewares/admin/admin-common.module';
import { AuthCommonModule } from './middlewares/auth/auth-common.module';
import { SecurityModule } from './utils/security/security.module';
import { FileStorageModule } from './utils/storage/file-storage';
import { Env, validateEnv } from './config/env';
import { AccountModule } from './modules/users/account/account.module';
import { AdminAuthModule } from './modules/auth/staff/admin-auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { AddressesModule } from './modules/users/addresses/addresses.module';
import { AffiliateModule } from './modules/partners/affiliate/affiliate.module';
import { AuthModule } from './modules/auth/auth.module';
import { B2bModule } from './modules/partners/b2b/b2b.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HomeModule } from './modules/catalog/home/home.module';
import { LocationModule } from './modules/hyperlocal/location/location.module';
import { MarketingModule } from './modules/catalog/marketing/marketing.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PriceAlertsModule } from './modules/users/price-alerts/price-alerts.module';
import { ReturnsModule } from './modules/orders/returns/returns.module';
import { ReviewsModule } from './modules/catalog/reviews/reviews.module';
import { SellModule } from './modules/partners/sell/sell.module';
import { SiteModule } from './modules/site/site.module';
import { SettingsModule } from './modules/users/settings/settings.module';
import { ShoppingModule } from './modules/orders/cart/shopping.module';
import { StoresModule } from './modules/partners/stores/stores.module';
import { SupportModule } from './modules/support/support.module';
import { WalletModule } from './modules/users/wallet/wallet.module';
import { HealthController } from './modules/health/health.controller';
import { PrismaModule } from './database/prisma.module';
import { CheckoutModule } from './modules/orders/checkout/checkout.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        throttlers: [{ name: 'default', ttl: 60_000, limit: 100 }],
        skipIf: () => config.get('NODE_ENV', { infer: true }) === 'test',
      }),
    }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuthCommonModule,
    SecurityModule,
    AdminCommonModule,
    FileStorageModule,

    // Feature modules: add one line per module.
    SiteModule,
    AuthModule,
    LocationModule,
    CatalogModule,
    StoresModule,
    ShoppingModule,
    CheckoutModule,
    MarketingModule,
    HomeModule,
    WalletModule,
    OrdersModule,
    AccountModule,
    AddressesModule,
    PriceAlertsModule,
    ReturnsModule,
    ReviewsModule,
    B2bModule,
    AffiliateModule,
    SupportModule,
    SettingsModule,
    SellModule,
    AdminAuthModule,
    AdminModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
