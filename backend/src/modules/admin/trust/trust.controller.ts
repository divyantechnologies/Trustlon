import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { actorOf } from '../../../middlewares/admin/audit.service';
import { AdminController, Can } from '../../../middlewares/admin/decorators';
import { AuthUser } from '../../../middlewares/auth/auth-user';
import { CurrentUser } from '../../../middlewares/auth/decorators';
import { JwtAuthGuard } from '../../../middlewares/auth/jwt-auth.guard';
import { PrismaService } from '../../../database/prisma.service';
import {
  CreateReportDto,
  FlaggedReviewsQuery,
  ReportActionDto,
  ReportsQuery,
  ReviewActionDto,
} from './dto';
import { AdminTrustService } from './trust.service';

@AdminController('')
export class AdminTrustController {
  constructor(
    private readonly trust: AdminTrustService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('reviews/flagged')
  @Can('trust', 'view')
  flagged(@Query() query: FlaggedReviewsQuery) {
    return this.trust.flaggedReviews(query);
  }

  @Post('reviews/:id/action')
  @Can('trust', 'approve')
  @HttpCode(HttpStatus.OK)
  reviewAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewActionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    return this.trust.reviewAction(id, dto, actorOf(user, req));
  }

  @Get('reports')
  @Can('trust', 'view')
  reports(@Query() query: ReportsQuery) {
    return this.trust.reports(query);
  }

  @Post('reports/:id/action')
  @Can('trust', 'approve')
  @HttpCode(HttpStatus.OK)
  async reportAction(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReportActionDto,
    @CurrentUser() user: AuthUser,
    @Req() req: Request,
  ) {
    const me = await this.prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { fullName: true },
    });
    return this.trust.reportAction(id, dto, actorOf(user, req), me.fullName);
  }
}

/** Storefront: "Report this product / review". */
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly trust: AdminTrustService) {}

  @Post()
  @Throttle({ default: { ttl: 3_600_000, limit: 20 } })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateReportDto) {
    return this.trust.createReport(user.id, dto);
  }
}
