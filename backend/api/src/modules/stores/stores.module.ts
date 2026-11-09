import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { LocationModule } from '../location/location.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [CatalogModule, LocationModule],
  controllers: [StoresController],
  providers: [StoresService],
  exports: [StoresService],
})
export class StoresModule {}
