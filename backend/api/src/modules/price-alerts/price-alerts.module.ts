import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PriceAlertsController } from './price-alerts.controller';
import { PriceAlertsService } from './price-alerts.service';

/** Price alerts. The notification job (Phase 2 worker) reads ACTIVE alerts that have been reached. */
@Module({
  imports: [CatalogModule],
  controllers: [PriceAlertsController],
  providers: [PriceAlertsService],
})
export class PriceAlertsModule {}
