import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser, Roles } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/roles.guard';
import { SellerDeliveryDto } from './dto';
import { SellerDeliveryService } from './seller-delivery.service';

@Controller('me/stores')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR_OWNER)
export class SellerDeliveryController {
  constructor(private readonly delivery: SellerDeliveryService) {}

  @Get('delivery')
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: AuthUser) {
    return this.delivery.list(user.id);
  }

  @Put(':id/delivery')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  save(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SellerDeliveryDto,
  ) {
    return this.delivery.save(user.id, id, dto);
  }
}
