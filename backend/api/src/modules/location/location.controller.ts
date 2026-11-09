import { BadRequestException, Controller, Get, Header, Param } from '@nestjs/common';
import { PINCODE_PATTERN, PincodeService } from './pincode.service';

@Controller('pincode')
export class LocationController {
  constructor(private readonly pincodes: PincodeService) {}

  /** Used by the header "Deliver to" dialog and the product page delivery checker. */
  @Get(':pincode/serviceability')
  @Header('Cache-Control', 'public, max-age=3600')
  serviceability(@Param('pincode') pincode: string) {
    if (!PINCODE_PATTERN.test(pincode)) {
      throw new BadRequestException('Enter a valid six-digit pincode');
    }
    return this.pincodes.serviceability(pincode);
  }
}
