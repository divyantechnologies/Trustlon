import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';
import { PAN_PATTERN } from '../../common/utils/gstin';
import { INDIAN_STATES } from '../addresses/dto';

const upper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toUpperCase() : value;
const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === ''
    ? undefined
    : typeof value === 'string'
      ? value.trim()
      : value;

export class GstinVerifyDto {
  @Transform(upper)
  @IsString()
  @Length(15, 15, { message: 'A GSTIN has 15 characters' })
  gstin!: string;
}

export class BusinessProfileDto {
  @Transform(trim)
  @IsString()
  @Length(2, 150, { message: 'Enter the registered business name' })
  businessName!: string;

  @Transform(upper)
  @IsString()
  @Length(15, 15, { message: 'A GSTIN has 15 characters' })
  gstin!: string;

  @Transform(upper)
  @Matches(PAN_PATTERN, { message: 'A PAN has 10 characters, e.g. ABCDE1234F' })
  pan!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'Enter the building and street of the billing address' })
  billingLine1!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  billingLine2?: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Enter the city' })
  billingCity!: string;

  @IsIn(INDIAN_STATES, { message: 'Choose a state from the list' })
  billingState!: string;

  @Transform(trim)
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid six-digit pincode' })
  billingPincode!: string;
}
