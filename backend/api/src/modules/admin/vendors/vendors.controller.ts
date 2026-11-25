import {
  Body,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { actorOf } from '../../../common/admin/audit.service';
import { PermissionsService } from '../../../common/admin/permissions.service';
import { sendCsv } from '../../../common/admin/csv';
import { AdminController, Can } from '../../../common/admin/decorators';
import { AuthUser } from '../../../common/auth/auth-user';
import { CurrentUser } from '../../../common/auth/decorators';
import { PrismaService } from '../../../prisma/prisma.service';
import { ReasonDto } from '../shared';
import {
  ApproveKycDto,
  CommissionDto,
  KYC_REJECTION_REASONS,
  KycQueueQuery,
  NoteDto,
  RejectKycDto,
  RequestDocumentsDto,
  ToggleDto,
  VendorListQuery,
} from './dto';
import { AdminVendorsService } from './vendors.service';

@AdminController('')
export class AdminVendorsController {
  constructor(
    private readonly vendors: AdminVendorsService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsService,
  ) {}

  @Get('vendors')
  @Can('vendors', 'view')
  async list(
    @Query() query: VendorListQuery,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (query.format === 'csv') {
      await this.permissions.assert(user.role, 'vendors:export');
      return sendCsv(res, 'vendors.csv', (await this.vendors.list(query)) as string);
    }
    return this.vendors.list(query);
  }

  @Get('vendors/:id')
  @Can('vendors', 'view')
  detail(@Param('id', ParseUUIDPipe) id: string) {
    return this.vendors.detail(id);
  }

  @Get('vendors/:id/documents/:documentId')
  @Can('vendors', 'view')
  async document(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const file = await this.vendors.document(id, documentId);
    res.set({
      'Content-Type': file.contentType,
      'Content-Disposition': `inline; filename="${(file.fileName ?? 'document').replace(/"/g, '')}"`,
    });
    return new StreamableFile(file.content);
  }

  @Get('kyc/queue')
  @Can('vendors', 'view')
  queue(@Query() query: KycQueueQuery) {
    return this.vendors.kycQueue(query);
  }

  @Get('kyc/reasons')
  @Can('vendors', 'view')
  reasons() {
    return { reasons: KYC_REJECTION_REASONS };
  }

  @Post('kyc/:vendorId/approve')
  @Can('vendors', 'approve')
  approve(
    @Param('vendorId', ParseUUIDPipe) id: string,
    @Body() dto: ApproveKycDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.approveKyc(id, dto, actorOf(user, req));
  }

  @Post('kyc/:vendorId/reject')
  @Can('vendors', 'approve')
  reject(
    @Param('vendorId', ParseUUIDPipe) id: string,
    @Body() dto: RejectKycDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.rejectKyc(id, dto, actorOf(user, req));
  }

  @Post('kyc/:vendorId/request-documents')
  @Can('vendors', 'approve')
  requestDocuments(
    @Param('vendorId', ParseUUIDPipe) id: string,
    @Body() dto: RequestDocumentsDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.requestDocuments(id, dto, actorOf(user, req));
  }

  @Post('vendors/:id/suspend')
  @Can('vendors', 'edit')
  suspend(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.suspend(id, dto.reason, actorOf(user, req));
  }

  @Post('vendors/:id/reinstate')
  @Can('vendors', 'edit')
  reinstate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReasonDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.reinstate(id, dto.reason, actorOf(user, req));
  }

  @Patch('vendors/:id/commission')
  @Can('vendors', 'edit')
  commission(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CommissionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.setCommission(id, dto, actorOf(user, req));
  }

  @Patch('vendors/:id/verified')
  @Can('vendors', 'edit')
  verified(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.setVerified(id, dto, actorOf(user, req));
  }

  @Patch('vendors/:id/payout-hold')
  @Can('vendors', 'edit')
  payoutHold(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.setPayoutHold(id, dto, actorOf(user, req));
  }

  @Patch('vendors/:id/review')
  @Can('vendors', 'edit')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ToggleDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.vendors.setUnderReview(id, dto, actorOf(user, req));
  }

  @Post('vendors/:id/notes')
  @Can('vendors', 'edit')
  async note(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: NoteDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true },
    });
    return this.vendors.addNote(id, dto, actorOf(user, req), me.fullName);
  }
}
