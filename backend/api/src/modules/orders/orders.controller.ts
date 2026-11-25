import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { AuthUser } from '../../common/auth/auth-user';
import { CurrentUser } from '../../common/auth/decorators';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { CancelSubOrderDto, OrderListQueryDto } from './dto';
import { InvoiceService } from './invoice.service';
import { OrdersService } from './orders.service';

/** Customer order endpoints. Every route is scoped to the signed-in customer. */
@Controller()
@UseGuards(JwtAuthGuard)
export class OrdersController {
  constructor(
    private readonly orders: OrdersService,
    private readonly invoices: InvoiceService,
  ) {}

  @Get('orders')
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: AuthUser, @Query() query: OrderListQueryDto) {
    return this.orders.list(user.id, query);
  }

  @Get('orders/:id')
  @Header('Cache-Control', 'private, no-store')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(user.id, id);
  }

  /** Allowed only before the seller ships. Returns the updated order. */
  @Post('sub-orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelSubOrderDto,
  ) {
    return this.orders.cancel(user.id, id, dto);
  }

  /** Tax invoice for a sub-order, as a PDF download. */
  @Get('invoices/:id/pdf')
  async invoice(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const file = await this.invoices.pdf(user.id, id);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${file.fileName}"`,
      'Cache-Control': 'private, no-store',
    });
    return new StreamableFile(file.content);
  }

  @Get('shipments/:awb/tracking')
  @Header('Cache-Control', 'private, no-store')
  tracking(@CurrentUser() user: AuthUser, @Param('awb') awb: string) {
    return this.orders.tracking(user.id, awb.trim().slice(0, 40));
  }
}
