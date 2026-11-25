import { Module } from '@nestjs/common';
import { CitySearchService } from './city-search.service';
import { CountriesController, LocationController } from './location.controller';
import { PincodeService } from './pincode.service';

@Module({
  controllers: [LocationController, CountriesController],
  providers: [PincodeService, CitySearchService],
  exports: [PincodeService],
})
export class LocationModule {}
