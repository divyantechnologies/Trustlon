import { Type } from 'class-transformer';
import { IsIn, IsOptional, Matches } from 'class-validator';
import { LOCAL_RADII_KM, LocalRadius } from './stores.service';

export class LocalQueryDto {
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid six-digit pincode' })
  pincode: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn(LOCAL_RADII_KM as unknown as number[], { message: 'radiusKm must be 5, 10 or 25' })
  radiusKm: LocalRadius = 10;
}
