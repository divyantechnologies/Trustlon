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
import { PERSON_NAME, PERSON_NAME_MESSAGE } from '../../../utils/identifier';

/** Kept here for older imports; the list lives with the other address rules. */
export { INDIAN_STATES } from '../../hyperlocal/location/address-rules';

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
  @Matches(PERSON_NAME, { message: PERSON_NAME_MESSAGE })
  fullName!: string;

  /** Indian mobile for Indian addresses; a number from the address's country otherwise. */
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

  /** ISO 3166-1 alpha-2 country. India (IN) when left out. */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  @Matches(/^[A-Z]{2}$/, { message: 'Choose a country' })
  country?: string;

  /** Pincode for India; the postal or ZIP code elsewhere. Checked per country in the service. */
  @Transform(trim)
  @IsString()
  @MaxLength(12)
  pincode!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Enter the city or town' })
  city!: string;

  /** Checked against the country's list of states in the service. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(60)
  state?: string;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
