import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { actorOf } from '../../../middlewares/admin/audit.service';
import { sendCsv } from '../../../middlewares/admin/csv';
import { AdminController, Can } from '../../../middlewares/admin/decorators';
import { PermissionsService } from '../../../middlewares/admin/permissions.service';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { PrismaService } from '../../../database/prisma.service';
import { AdminCancelDto, OrderListQuery, OrderNoteDto, ReassignCourierDto, RefundDto } from './dto';
import { AdminOrdersService } from './orders.service';

@AdminController('orders')
export class AdminOrdersController {
  constructor(
    private readonly orders: AdminOrdersService,
    private readonly permissions: PermissionsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @Can('orders', 'view')
  async list(
    @Query() query: OrderListQuery,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'csv') {
      await this.permissions.assert(user.role, 'orders:export');
      return sendCsv(res, 'orders.csv', (await this.orders.list(query)) as string);
    }
    return this.orders.list(query);
  }

  @Get(':id')
  @Can('orders', 'view')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.orders.detail(id);
  }

  @Post(':id/cancel')
  @Can('orders', 'edit')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdminCancelDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.cancel(id, dto, actorOf(user, req));
  }

  @Post(':id/refund')
  @Can('orders', 'approve')
  @HttpCode(HttpStatus.OK)
  refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RefundDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.refund(id, dto, actorOf(user, req));
  }

  @Post(':id/reassign-courier')
  @Can('orders', 'edit')
  @HttpCode(HttpStatus.OK)
  reassign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReassignCourierDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.orders.reassignCourier(id, dto, actorOf(user, req));
  }

  @Post(':id/notes')
  @Can('orders', 'edit')
  async note(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OrderNoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true },
    });
    return this.orders.addNote(id, dto.body, actorOf(user, req), me.fullName);
  }
}
