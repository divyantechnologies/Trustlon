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
import { actorOf } from '../../../common/admin/audit.service';
import { sendCsv } from '../../../common/admin/csv';
import { AdminController, Can } from '../../../common/admin/decorators';
import { PermissionsService } from '../../../common/admin/permissions.service';
import { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { OptionalReasonDto, ReasonDto } from '../shared';
import { AuthenticityDto, ModerationQuery, ProductListQuery } from './dto';
import { AdminProductsService } from './products.service';

@AdminController('products')
export class AdminProductsController {
  constructor(
    private readonly products: AdminProductsService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('moderation')
  @Can('products', 'view')
  moderation(@Query() query: ModerationQuery) {
    return this.products.moderationQueue(query);
  }

  @Get()
  @Can('products', 'view')
  async list(
    @Query() query: ProductListQuery,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'csv') {
      await this.permissions.assert(user.role, 'products:export');
      return sendCsv(res, 'products.csv', (await this.products.list(query)) as string);
    }
    return this.products.list(query);
  }

  @Get(':id')
  @Can('products', 'view')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.products.detail(id);
  }

  @Post(':id/approve')
  @Can('products', 'approve')
  @HttpCode(HttpStatus.OK)
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: OptionalReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.approve(id, dto.reason, actorOf(user, req));
  }

  @Post(':id/reject')
  @Can('products', 'approve')
  @HttpCode(HttpStatus.OK)
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.reject(id, dto.reason, actorOf(user, req));
  }

  @Post(':id/request-changes')
  @Can('products', 'approve')
  @HttpCode(HttpStatus.OK)
  requestChanges(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.requestChanges(id, dto.reason, actorOf(user, req));
  }

  @Post(':id/authenticity')
  @Can('products', 'approve')
  @HttpCode(HttpStatus.OK)
  authenticity(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AuthenticityDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.authenticity(id, dto, actorOf(user, req));
  }

  @Post(':id/deactivate')
  @Can('products', 'edit')
  @HttpCode(HttpStatus.OK)
  deactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.setActive(id, false, dto.reason, actorOf(user, req));
  }

  @Post(':id/reactivate')
  @Can('products', 'edit')
  @HttpCode(HttpStatus.OK)
  reactivate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.products.setActive(id, true, dto.reason, actorOf(user, req));
  }
}
