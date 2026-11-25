import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminListQuery } from '../../../middlewares/admin/admin-query';
import { PERSON_NAME, PERSON_NAME_MESSAGE, normalizeMobile } from '../../../utils/identifier';
import { IsMobile } from '../../../utils/validation/is-mobile';
import { ReasonDto } from '../shared';

const STAFF_ROLE_VALUES = [
  'SUPER_ADMIN',
  'MARKETING',
  'FINANCE',
  'SUPPORT',
  'LOGISTICS',
  'CA',
  'BRAND_TEAM',
] as const;

export class CreateStaffDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value))
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  @Matches(PERSON_NAME, { message: PERSON_NAME_MESSAGE })
  fullName!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email!: string;

  @Transform(({ value }) => normalizeMobile(value) ?? value)
  @IsMobile()
  mobile!: string;

  @IsIn(STAFF_ROLE_VALUES)
  role!: UserRole;

  /** Give an existing customer account a staff role instead of creating a new account. */
  @IsOptional()
  @IsBoolean()
  promoteExisting?: boolean;
}

export class UpdateStaffDto extends ReasonDto {
  @IsOptional()
  @IsIn([...STAFF_ROLE_VALUES, 'CUSTOMER'])
  role?: UserRole;

  @IsOptional()
  @IsEnum(UserStatus)
  status?: UserStatus;
}

export class RolePermissionsDto {
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  permissions!: string[];
}

export class AuditQuery extends AdminListQuery {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  entity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  entityId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  action?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}
