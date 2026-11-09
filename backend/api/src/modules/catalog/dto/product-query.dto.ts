import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
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

  /** Vendor (store) slug. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  store?: string;

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
