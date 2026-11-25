import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { PageQueryDto } from '../../../utils/http/pagination';
import { LOCAL_RADII_KM, LocalRadius } from './local-rules';

export class LocalQueryDto extends PageQueryDto {
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid six-digit pincode' })
  pincode: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn(LOCAL_RADII_KM as unknown as number[], { message: 'radiusKm must be 5, 10 or 25' })
  radiusKm?: LocalRadius;

  @IsOptional()
  @Type(() => Number)
  @IsIn([...LOCAL_RADII_KM], { message: 'radius must be 5, 10 or 25' })
  radius?: LocalRadius;
}

export class SellerDeliveryDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 240)
  pickupAddress: string;

  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid six-digit pincode' })
  pickupPincode: string;

  @IsBoolean()
  sameDayDelivery: boolean;

  @IsBoolean()
  nextDayDelivery: boolean;

  @IsOptional()
  @Matches(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, { message: 'Cutoff must be HH:mm in India time' })
  deliveryCutoffTime?: string | null;
}
