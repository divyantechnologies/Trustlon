import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { JwtAuthGuard } from '../../../middlewares/auth/jwt-auth.guard';
import { B2bService } from './b2b.service';
import { BusinessProfileDto, GstinVerifyDto } from './dto';

/** B2B buyer profile (spec 3.8). Admin verifies profiles in Vendor management and KYC (5.2). */
@Controller()
@UseGuards(JwtAuthGuard)
export class B2bController {
  constructor(private readonly b2b: B2bService) {}

  @Get('me/b2b')
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentUser() user: AuthUser) {
    return this.b2b.get(user.id);
  }

  @Post('me/b2b')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  save(@CurrentUser() user: AuthUser, @Body() dto: BusinessProfileDto) {
    return this.b2b.save(user.id, dto);
  }

  /** Checks format, state code and check digit, and returns the PAN and state inside the GSTIN. */
  @Post('kyc/gstin/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  verify(@Body() dto: GstinVerifyDto) {
    return this.b2b.verifyGstin(dto.gstin);
  }
}
