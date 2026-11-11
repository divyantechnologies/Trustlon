import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PageQueryDto } from '../../../common/http/pagination';

export const PRODUCT_SORTS = [
  'relevance',
  'popularity',
  'price_asc',
  'price_desc',
  'newest',
  'rating',
] as const;
export type ProductSort = (typeof PRODUCT_SORTS)[number];

const toBool = ({ value }: { value: unknown }) =>
  value === true || value === 'true' || value === '1' ? true : value === undefined ? undefined : false;

/** Accepts `a,b`, repeated keys (`?brand=a&brand=b`) or a single value. Empty becomes undefined. */
const toList = ({ value }: { value: unknown }) => {
  const parts = (Array.isArray(value) ? value : [value])
    .flatMap((part) => (typeof part === 'string' ? part.split(',') : []))
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.length ? [...new Set(parts)] : undefined;
};

export const LOCAL_RADII = [5, 10, 25] as const;

export class ProductQueryDto extends PageQueryDto {
  /** Free-text search over name, brand, seller and category. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;

  /** Category slug; includes its sub-categories. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  category?: string;

  /** One or more vendor (store) slugs: `store=a,b` or repeated keys. */
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  store?: string[];

  /** One or more brand names, exactly as returned by /products/facets. */
  @IsOptional()
  @Transform(toList)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(80, { each: true })
  brand?: string[];

  /** Minimum average rating, 0 to 5 (e.g. 4 for "4★ & above"). */
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  minRating?: number;

  /** Minimum percent off MRP at the base price (e.g. 30 for "30% or more"). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(95)
  minDiscount?: number;

  /** Only Trustlon Verified sellers. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  verified?: boolean;

  /** Only products that can be paid with cash on delivery. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  cod?: boolean;

  /** Only same-day local sellers near this pincode (Local Sellers filter). */
  @IsOptional()
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid six-digit pincode' })
  nearPincode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn(LOCAL_RADII as unknown as number[], { message: 'radiusKm must be 5, 10 or 25' })
  radiusKm: number = 10;

  /** Only Trustlon's own brand. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  originals?: boolean;

  /** Only combo / bundle products. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  bundle?: boolean;

  /** Only products with an active deal. */
  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  deals?: boolean;

  @IsOptional()
  @Transform(toBool)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPricePaise?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPricePaise?: number;

  @IsOptional()
  @IsIn(PRODUCT_SORTS)
  sort: ProductSort = 'relevance';
}

export class SuggestQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}