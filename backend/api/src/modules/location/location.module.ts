import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { PincodeService } from './pincode.service';

@Module({
  controllers: [LocationController],
  providers: [PincodeService],
  exports: [PincodeService],
})
export class LocationModule {}
