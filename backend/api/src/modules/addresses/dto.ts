import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';

/** States and union territories of India, as used on delivery addresses. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

export const ADDRESS_LABELS = ['HOME', 'WORK', 'OTHER'] as const;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const emptyToUndefined = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
};

export class AddressDto {
  @IsIn(ADDRESS_LABELS)
  label!: (typeof ADDRESS_LABELS)[number];

  /** Required when the label is OTHER. */
  @ValidateIf((dto: AddressDto) => dto.label === 'OTHER')
  @Transform(trim)
  @IsString()
  @Length(2, 30, { message: 'Give this address a name of 2 to 30 characters' })
  labelName?: string;

  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Enter the full name of the person receiving the order' })
  fullName!: string;

  /** Indian mobile number, with or without +91. */
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  mobile!: string;

  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'Enter the house number and street (3 to 120 characters)' })
  line1!: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(120)
  line2?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(80)
  landmark?: string;

  @Transform(trim)
  @Matches(/^[1-9][0-9]{5}$/, { message: 'Enter a valid six-digit pincode' })
  pincode!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Enter the city or town' })
  city!: string;

  @IsIn(INDIAN_STATES, { message: 'Choose a state from the list' })
  state!: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
