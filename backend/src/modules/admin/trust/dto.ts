import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { ReportReason, ReportStatus, ReportTarget } from '@prisma/client';

export const REVIEW_ACTIONS = ['publish', 'remove'] as const;
export const REPORT_ACTIONS = [
  'dismiss',
  'publish_review',
  'remove_review',
  'delist_product',
  'warn_vendor',
  'open_suspension_review',
] as const;
export type ReportAction = (typeof REPORT_ACTIONS)[number];

export class FlaggedReviewsQuery {
  @IsOptional()
  @IsIn(['held', 'reported', 'all'])
  view?: 'held' | 'reported' | 'all';
}

export class ReviewActionDto {
  @IsIn(REVIEW_ACTIONS)
  action!: (typeof REVIEW_ACTIONS)[number];

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Add a short reason' })
  @MaxLength(300)
  reason!: string;
}

export class ReportsQuery {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;

  @IsOptional()
  @IsEnum(ReportTarget)
  targetType?: ReportTarget;
}

export class ReportActionDto {
  @IsIn(REPORT_ACTIONS)
  action!: ReportAction;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Add a short note' })
  @MaxLength(500)
  note!: string;
}

/** A customer reporting a listing or a review from the storefront. */
export class CreateReportDto {
  @IsIn([ReportTarget.PRODUCT, ReportTarget.REVIEW])
  targetType!: ReportTarget;

  @IsUUID()
  targetId!: string;

  @IsEnum(ReportReason)
  reason!: ReportReason;

  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(1000)
  details?: string;
}
