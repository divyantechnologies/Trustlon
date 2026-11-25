import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMethod, PaymentStatus, SubOrderStatus } from '@prisma/client';
import { AdminListQuery } from '../../../common/admin/admin-query';
import { ReasonDto } from '../shared';

export class OrderListQuery extends AdminListQuery {
  @IsOptional()
  @IsEnum(SubOrderStatus)
  status?: SubOrderStatus;

  @IsOptional()
  @IsEnum(PaymentStatus)
  paymentStatus?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsUUID()
  vendorId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  from?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  to?: string;
}

export class AdminCancelDto extends ReasonDto {
  /** Sub-orders to cancel; empty or missing cancels every sub-order that can still be cancelled. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsUUID('4', { each: true })
  subOrderIds?: string[];
}

export class RefundDto extends ReasonDto {
  @IsUUID()
  subOrderId!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amountRupees!: number;

  @IsIn(['WALLET', 'ORIGINAL'])
  method!: 'WALLET' | 'ORIGINAL';
}

export class ReassignCourierDto extends ReasonDto {
  @IsUUID()
  subOrderId!: string;

  @Matches(/^[A-Z0-9_]{2,20}$/)
  courierCode!: string;

  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z0-9-]{6,40}$/, { message: 'Enter the new AWB (tracking) number' })
  awb!: string;
}

export class OrderNoteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(1000)
  body!: string;
}
