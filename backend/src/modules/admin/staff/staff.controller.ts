import {
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { Request, Response } from 'express';
import { actorOf } from '../../../middlewares/admin/audit.service';
import { sendCsv } from '../../../middlewares/admin/csv';
import { AdminController, Can, SuperAdminOnly } from '../../../middlewares/admin/decorators';
import { PermissionsService } from '../../../middlewares/admin/permissions.service';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { ReasonDto } from '../shared';
import { AuditQuery, CreateStaffDto, RolePermissionsDto, UpdateStaffDto } from './dto';
import { AdminStaffService } from './staff.service';

@AdminController('')
export class AdminStaffController {
  constructor(
    private readonly staff: AdminStaffService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('staff')
  @Can('staff', 'view')
  list() {
    return this.staff.list();
  }

  @Post('staff')
  @Can('staff', 'create')
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.create(dto, actorOf(user, req));
  }

  @Patch('staff/:id')
  @Can('staff', 'edit')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.update(id, dto, actorOf(user, req));
  }

  @Post('staff/:id/reset-2fa')
  @Can('staff', 'edit')
  @HttpCode(HttpStatus.OK)
  resetTwoFactor(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.resetTwoFactor(id, dto.reason, actorOf(user, req));
  }

  @Post('staff/:id/reset-password')
  @Can('staff', 'edit')
  @HttpCode(HttpStatus.OK)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.resetPassword(id, dto.reason, actorOf(user, req));
  }

  @Get('roles')
  @Can('staff', 'view')
  roles() {
    return this.staff.roles();
  }

  @Patch('roles/:role')
  @SuperAdminOnly()
  setRole(
    @Param('role', new ParseEnumPipe(UserRole)) role: UserRole,
    @Body() dto: RolePermissionsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.setRole(role, dto.permissions, actorOf(user, req));
  }

  @Post('roles/:role/reset')
  @SuperAdminOnly()
  @HttpCode(HttpStatus.OK)
  resetRole(
    @Param('role', new ParseEnumPipe(UserRole)) role: UserRole,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.staff.resetRole(role, actorOf(user, req));
  }

  @Get('audit-log')
  @Can('audit', 'view')
  async audit(
    @Query() query: AuditQuery,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'csv') {
      await this.permissions.assert(user.role, 'audit:export');
      return sendCsv(res, 'audit-log.csv', (await this.staff.auditLog(query)) as string);
    }
    return this.staff.auditLog(query);
  }
}
