import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { BusinessVerificationStatus, UserStatus } from '@prisma/client';
import { AdminListQuery } from '../../../common/admin/admin-query';
import { OptionalReasonDto, ReasonDto } from '../shared';

const bool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class CustomerListQuery extends AdminListQuery {
  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;

  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  b2b?: boolean;

  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  codDisabled?: boolean;
}

export class CustomerStatusDto extends ReasonDto {
  @IsEnum(UserStatus)
  status!: UserStatus;
}

export class CodDto extends ReasonDto {
  @IsBoolean()
  disabled!: boolean;
}

export class B2bDecisionDto extends OptionalReasonDto {
  @IsIn([BusinessVerificationStatus.VERIFIED, BusinessVerificationStatus.REJECTED])
  decision!: BusinessVerificationStatus;
}

export class WalletAdjustmentDto extends ReasonDto {
  @IsIn(['CREDIT', 'DEBIT'])
  direction!: 'CREDIT' | 'DEBIT';

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100_000)
  amountRupees!: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1_000_000)
  coins?: number;
}
