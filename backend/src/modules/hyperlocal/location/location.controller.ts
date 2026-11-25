import {
  BadRequestException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { countryList, isCountryCode, statesOf } from './address-rules';
import { CitySearchService } from './city-search.service';
import { PINCODE_PATTERN, PincodeService } from './pincode.service';

class SearchQuery {
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}

const SEARCH_THROTTLE = { default: { limit: 120, ttl: 60_000 } };

@Controller('pincode')
export class LocationController {
  constructor(private readonly pincodes: PincodeService) {}

  /** Suggestions while typing a pincode, area or city: ?q=5600 or ?q=kora */
  @Get('search')
  @Throttle(SEARCH_THROTTLE)
  @Header('Cache-Control', 'public, max-age=3600')
  async search(@Query() query: SearchQuery) {
    return { items: await this.pincodes.search(query.q ?? '') };
  }

  /** Used by the header "Deliver to" dialog and the product page delivery checker. */
  @Get(':pincode/serviceability')
  @Header('Cache-Control', 'public, max-age=3600')
  serviceability(@Param('pincode') pincode: string) {
    if (!PINCODE_PATTERN.test(pincode)) {
      throw new BadRequestException('Enter a valid six-digit pincode');
    }
    return this.pincodes.serviceability(pincode);
  }

  /** Area, city and state for one pincode, to fill in address forms. */
  @Get(':pincode')
  @Throttle(SEARCH_THROTTLE)
  @Header('Cache-Control', 'public, max-age=86400')
  async lookup(@Param('pincode') pincode: string) {
    if (!PINCODE_PATTERN.test(pincode)) {
      throw new BadRequestException('Enter a valid six-digit pincode');
    }
    const found = await this.pincodes.lookup(pincode);
    if (!found) throw new NotFoundException('We couldn’t find this pincode. Check the number.');
    return found;
  }
}

/** Countries, states and cities for address forms anywhere in the app. */
@Controller('location')
export class CountriesController {
  constructor(
    private readonly pincodes: PincodeService,
    private readonly cities: CitySearchService,
  ) {}

  @Get('countries')
  @Header('Cache-Control', 'public, max-age=86400')
  countries() {
    return { items: countryList() };
  }

  @Get('countries/:code/states')
  @Header('Cache-Control', 'public, max-age=86400')
  states(@Param('code') raw: string) {
    const code = this.country(raw);
    return { items: statesOf(code) };
  }

  @Get('countries/:code/cities')
  @Throttle(SEARCH_THROTTLE)
  @Header('Cache-Control', 'public, max-age=3600')
  async citiesOf(@Param('code') raw: string, @Query() query: SearchQuery) {
    const code = this.country(raw);
    const q = query.q ?? '';
    return {
      items:
        code === 'IN' ? await this.pincodes.indianCities(q) : await this.cities.search(code, q),
    };
  }

  private country(raw: string): string {
    const code = raw.toUpperCase();
    if (!isCountryCode(code)) throw new NotFoundException('Unknown country');
    return code;
  }
}
