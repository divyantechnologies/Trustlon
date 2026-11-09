import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { MAX_QUANTITY_PER_ITEM } from '../catalog/product.presenter';

export class AddCartItemDto {
  @IsUUID()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity = 1;
}

export class SetQuantityDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_QUANTITY_PER_ITEM)
  quantity: number;
}

export class ProductRefDto {
  @IsUUID()
  productId: string;
}
