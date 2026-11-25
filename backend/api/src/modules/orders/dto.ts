import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { PageQueryDto } from '../../common/http/pagination';
import {
  CANCEL_REASONS,
  CancelReason,
  ORDER_STATUS_GROUP_KEYS,
  OrderStatusGroup,
} from './order-rules';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class OrderListQueryDto extends PageQueryDto {
  /** active, delivered, cancelled or returns. */
  @IsOptional()
  @IsIn(ORDER_STATUS_GROUP_KEYS)
  status?: OrderStatusGroup;

  /** Matches product names in the order. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q?: string;

  /** First day to include, YYYY-MM-DD. */
  @IsOptional()
  @Matches(DATE, { message: 'from must be a date in YYYY-MM-DD format' })
  from?: string;

  /** Last day to include, YYYY-MM-DD. */
  @IsOptional()
  @Matches(DATE, { message: 'to must be a date in YYYY-MM-DD format' })
  to?: string;
}

export class CancelSubOrderDto {
  @IsIn(Object.keys(CANCEL_REASONS))
  reason!: CancelReason;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(250)
  comment?: string;
}
