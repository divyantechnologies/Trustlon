import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthCommonModule } from './common/auth/auth-common.module';
import { Env, validateEnv } from './config/env';
import { AccountModule } from './modules/account/account.module';
import { AuthModule } from './modules/auth/auth.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HomeModule } from './modules/home/home.module';
import { LocationModule } from './modules/location/location.module';
import { MarketingModule } from './modules/marketing/marketing.module';
import { OrdersModule } from './modules/orders/orders.module';
import { ShoppingModule } from './modules/shopping/shopping.module';
import { StoresModule } from './modules/stores/stores.module';
import { WalletModule } from './modules/wallet/wallet.module';
import { HealthController } from './modules/health/health.controller';
import { PrismaModule } from './prisma/prisma.module';

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

    // Feature modules: add one line per module.
    AuthModule,
    LocationModule,
    CatalogModule,
    StoresModule,
    ShoppingModule,
    MarketingModule,
    HomeModule,
    WalletModule,
    OrdersModule,
    AccountModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
