import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { AttributeType } from '@prisma/client';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const HSN = /^\d{4}(\d{2}){0,2}$/;
/** GST slabs from September 2025 (spec 5.3). */
export const GST_RATES = [0, 5, 18, 40];
export const MAX_CATEGORY_DEPTH = 4;

class CategoryFields {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(80)
  nameHi?: string;

  @IsOptional()
  @Matches(SLUG, { message: 'Use lower-case letters, numbers and hyphens' })
  @MaxLength(80)
  slug?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(300)
  imageUrl?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null && value !== '')
  @Matches(HSN, { message: 'HSN codes have 4, 6 or 8 digits' })
  defaultHsn?: string | null;

  /** Null uses the platform default commission. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  commissionPercent?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(90)
  returnWindowDays?: number;

  @IsOptional()
  @IsBoolean()
  moderationRequired?: boolean;

  @IsOptional()
  @IsBoolean()
  codAllowed?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CategoryDto extends CategoryFields {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class UpdateCategoryDto extends CategoryFields {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}

export class ReorderItemDto {
  @IsUUID()
  id!: string;

  @ValidateIf((_, value) => value !== null)
  @IsUUID()
  parentId!: string | null;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class ReorderDto {
  @IsArray()
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ReorderItemDto)
  items!: ReorderItemDto[];
}

class AttributeFields {
  @IsOptional()
  @IsString()
  @MaxLength(16)
  unit?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(60, { each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isFilterable?: boolean;

  @IsOptional()
  @IsBoolean()
  isVariant?: boolean;
}

export class AttributeDto extends AttributeFields {
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;

  @IsOptional()
  @Matches(/^[a-z][a-z0-9_]{1,39}$/, { message: 'Use lower-case letters, numbers and _' })
  code?: string;

  @IsEnum(AttributeType)
  type!: AttributeType;
}

export class UpdateAttributeDto extends AttributeFields {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name?: string;

  @IsOptional()
  @IsEnum(AttributeType)
  type?: AttributeType;
}

export class CategoryAttributeItemDto {
  @IsUUID()
  attributeId!: string;

  @IsBoolean()
  isRequired!: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder!: number;
}

export class CategoryAttributesDto {
  @IsArray()
  @ArrayMaxSize(60)
  @ValidateNested({ each: true })
  @Type(() => CategoryAttributeItemDto)
  items!: CategoryAttributeItemDto[];
}

export class HsnDto {
  @Matches(HSN, { message: 'HSN codes have 4, 6 or 8 digits' })
  code!: string;

  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(300)
  description!: string;

  @Type(() => Number)
  @IsIn(GST_RATES, { message: 'GST rate must be 0, 5, 18 or 40%' })
  gstRatePercent!: number;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Use YYYY-MM-DD' })
  effectiveFrom!: string;
}

export class HsnQuery {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  q?: string;
}
