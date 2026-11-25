import { Body, Controller, Get, Header, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { FeeCalculatorDto, VendorLeadDto } from './dto';
import { SellService } from './sell.service';

/** Public endpoints behind the Become a vendor page (spec 3.12). No sign-in needed. */
@Controller('public')
export class SellController {
  constructor(private readonly sell: SellService) {}

  @Get('commission-rates')
  @Header('Cache-Control', 'public, max-age=300')
  commissionRates() {
    return this.sell.commissionRates();
  }

  @Post('fee-calculator')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  calculate(@Body() dto: FeeCalculatorDto) {
    return this.sell.calculate(dto);
  }

  @Post('vendor-leads')
  @Throttle({ default: { limit: 3, ttl: 60 * 60_000 } })
  createLead(@Body() dto: VendorLeadDto, @Req() req: Request) {
    return this.sell.createLead(dto, req.ip);
  }
}
