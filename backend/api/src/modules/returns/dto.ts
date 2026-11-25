import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ReturnReason, ReturnRefundMethod } from '@prisma/client';
import { PageQueryDto } from '../../common/http/pagination';

export const MAX_RETURN_PHOTOS = 5;

const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class ReturnItemDto {
  @IsUUID()
  orderItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateReturnDto {
  @IsUUID()
  subOrderId!: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one item to return' })
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ReturnItemDto)
  items!: ReturnItemDto[];

  @IsIn(Object.values(ReturnReason))
  reason!: ReturnReason;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(500)
  comments?: string;

  /** Ids from POST /returns/photos. */
  @IsArray()
  @ArrayMaxSize(MAX_RETURN_PHOTOS, { message: `Add up to ${MAX_RETURN_PHOTOS} photos` })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  photoIds: string[] = [];

  /** A saved address; leave out to use the delivery address of the order. */
  @IsOptional()
  @IsUUID()
  pickupAddressId?: string;

  @IsIn(Object.values(ReturnRefundMethod))
  refundMethod!: ReturnRefundMethod;
}

export class ReturnListQueryDto extends PageQueryDto {}
