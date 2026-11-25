import { IsEnum, IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { AuthenticityStatus, ProductStatus, SubmissionKind } from '@prisma/client';
import { AdminListQuery } from '../../../common/admin/admin-query';
import { OptionalReasonDto } from '../shared';

export class ProductListQuery extends AdminListQuery {
  @IsOptional()
  @IsEnum(ProductStatus)
  status?: ProductStatus;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(AuthenticityStatus)
  authenticity?: AuthenticityStatus;
}

export class ModerationQuery {
  @IsOptional()
  @IsEnum(SubmissionKind)
  kind?: SubmissionKind;
}

export class AuthenticityDto extends OptionalReasonDto {
  @IsIn([
    AuthenticityStatus.FLAGGED,
    AuthenticityStatus.VERIFIED,
    AuthenticityStatus.FAILED,
    AuthenticityStatus.NOT_REQUIRED,
  ])
  status!: AuthenticityStatus;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  note?: string;
}
