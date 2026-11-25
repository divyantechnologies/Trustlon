import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  EMAIL_PATTERN,
  MOBILE_RULE_MESSAGE,
  normalizeEmail,
  normalizeMobile,
  PERSON_NAME,
  PERSON_NAME_MESSAGE,
} from '../../../utils/identifier';
import { IsMobile } from '../../../utils/validation/is-mobile';
import { MAX_PRICE_PAISE, MIN_PRICE_PAISE, PRODUCT_GST_RATES_BPS } from './fees';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const optional = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

export class FeeCalculatorDto {
  @Type(() => Number)
  @IsInt()
  @Min(MIN_PRICE_PAISE, { message: 'Enter a selling price of at least ₹1' })
  @Max(MAX_PRICE_PAISE, { message: 'Enter a selling price up to ₹1 crore' })
  pricePaise!: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsIn([...PRODUCT_GST_RATES_BPS], { message: 'Choose a GST rate of 0%, 5%, 18% or 40%' })
  gstRateBps?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_00)
  shippingPaise?: number;
}

export class VendorLeadDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Enter your name' })
  @Matches(PERSON_NAME, { message: PERSON_NAME_MESSAGE })
  contactName!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 160, { message: 'Enter your business name' })
  businessName!: string;

  @Transform(({ value }) => normalizeMobile(value) ?? value)
  @IsMobile({ message: MOBILE_RULE_MESSAGE })
  mobile!: string;

  @Transform(({ value }) => normalizeEmail(value) ?? value)
  @Matches(EMAIL_PATTERN, { message: 'Enter a valid email address, e.g. name@example.com' })
  @MaxLength(254)
  email!: string;

  @Transform(trim)
  @IsString()
  @Length(2, 80, { message: 'Enter your city' })
  city!: string;

  @Transform(optional)
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() ? value.trim().toUpperCase() : undefined,
  )
  @IsOptional()
  @Matches(/^[0-9A-Z]{15}$/, { message: 'A GSTIN has 15 characters, e.g. 29ABCDE1234F1Z5' })
  gstin?: string;
}
