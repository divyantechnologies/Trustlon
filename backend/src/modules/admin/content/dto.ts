import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { CouponAudience, CouponType, SeoEntity } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;

class CouponFields {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  description?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxDiscountPaise?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minOrderPaise?: number;

  @IsOptional()
  @IsEnum(CouponAudience)
  audience?: CouponAudience;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  categoryIds?: string[];

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  usageLimit?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perUserLimit?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Percent coupons: 1–90 (stored as basis points). Flat coupons: paise. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  value?: number;
}

export class CouponDto extends CouponFields {
  @Transform(upper)
  @Matches(/^[A-Z0-9]{3,20}$/, { message: 'Use 3 to 20 capital letters and numbers' })
  code!: string;

  @IsEnum(CouponType)
  type!: CouponType;
}

export class UpdateCouponDto extends CouponFields {}

export class SeoDto {
  @IsEnum(SeoEntity)
  entity!: SeoEntity;

  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'Unknown page' })
  @MaxLength(160)
  entityKey!: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(70, { message: 'Keep titles to 70 characters' })
  title?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(170, { message: 'Keep descriptions to 170 characters' })
  description?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Transform(trim)
  @IsString()
  @MaxLength(255)
  keywords?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  ogImageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  noIndex?: boolean;
}

const PATH = /^\/[A-Za-z0-9\-._~/%]*$/;

export class RedirectDto {
  @Transform(trim)
  @Matches(PATH, { message: 'Start with / and use a storefront path, e.g. /c/old-name' })
  @MaxLength(300)
  fromPath!: string;

  @Transform(trim)
  @Matches(/^(\/[A-Za-z0-9\-._~/%?=&]*|https:\/\/[^\s]+)$/, {
    message: 'Use a storefront path (/c/new-name) or an https:// link',
  })
  @MaxLength(500)
  toPath!: string;

  @IsOptional()
  @IsBoolean()
  permanent?: boolean;
}

export class PageDto {
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, { message: 'Use lower-case letters, numbers and hyphens' })
  @MaxLength(80)
  slug!: string;

  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(100_000)
  body!: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdatePageDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  body?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
