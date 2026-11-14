import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PriceAlertStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { PriceAlertsService } from './price-alerts.service';

class CreatePriceAlertDto {
  @IsUUID()
  productId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  targetPricePaise!: number;
}

class UpdatePriceAlertDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(100)
  @Max(1_000_000_000)
  targetPricePaise?: number;

  @IsOptional()
  @IsIn(Object.values(PriceAlertStatus))
  status?: PriceAlertStatus;
}

/** Price alerts. Every write returns the updated list, newest first. */
@Controller('me/price-alerts')
@UseGuards(JwtAuthGuard)
export class PriceAlertsController {
  constructor(private readonly alerts: PriceAlertsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  async list(@CurrentUser() user: AuthUser) {
    return { items: await this.alerts.list(user.id) };
  }

  @Post()
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreatePriceAlertDto) {
    return { items: await this.alerts.upsert(user.id, dto.productId, dto.targetPricePaise) };
  }

  @Patch(':id')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePriceAlertDto,
  ) {
    return { items: await this.alerts.update(user.id, id, dto) };
  }

  @Delete(':id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return { items: await this.alerts.remove(user.id, id) };
  }
}
