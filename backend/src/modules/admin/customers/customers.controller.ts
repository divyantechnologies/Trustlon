import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { AdminCustomersService } from './customers.service';
import {
  B2bDecisionDto,
  CodDto,
  CustomerListQuery,
  CustomerStatusDto,
  WalletAdjustmentDto,
} from './dto';

@AdminController('customers')
export class AdminCustomersController {
  constructor(
    private readonly customers: AdminCustomersService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get()
  @Can('customers', 'view')
  async list(
    @Query() query: CustomerListQuery,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'csv') {
      await this.permissions.assert(user.role, 'customers:export');
      return sendCsv(res, 'customers.csv', (await this.customers.list(query)) as string);
    }
    return this.customers.list(query);
  }

  @Get(':id')
  @Can('customers', 'view')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.customers.detail(id);
  }

  @Patch(':id/status')
  @Can('customers', 'edit')
  status(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CustomerStatusDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.setStatus(id, dto, actorOf(user, req));
  }

  @Patch(':id/cod')
  @Can('customers', 'edit')
  cod(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CodDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.setCod(id, dto, actorOf(user, req));
  }

  @Post(':id/b2b')
  @Can('customers', 'approve')
  @HttpCode(HttpStatus.OK)
  b2b(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: B2bDecisionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.decideB2b(id, dto, actorOf(user, req));
  }

  @Post(':id/wallet-adjustment')
  @Can('customers', 'approve')
  @HttpCode(HttpStatus.OK)
  wallet(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: WalletAdjustmentDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.customers.adjustWallet(id, dto, actorOf(user, req));
  }
}
