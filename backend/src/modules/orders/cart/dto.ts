import { Type } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, IsUUID, Matches, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../../catalog/product.presenter';

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity: number;
}

export class SetQuantityDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity?: number;

  @IsOptional()
  @IsBoolean()
  savedForLater?: boolean;

  @IsOptional()
  @IsBoolean()
  moveToWishlist?: boolean;

  @IsOptional()
  @IsBoolean()
  coinsEnabled?: boolean;
}

export class CouponDto {
  @Matches(/^[A-Za-z0-9_-]{1,40}$/)
  code: string;
}

export class ProductRefDto {
  @IsUUID()
  productId: string;
}
