import { Language, OtpPurpose } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsISO31661Alpha2,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { normalizeEmail, normalizePhone } from '../../../common/utils/identifier';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../auth.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toEmail = ({ value }: { value: unknown }) => normalizeEmail(value) ?? value;
const toPhone = ({ value }: { value: unknown }) => normalizePhone(value) ?? value;
const optionalUpper = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.trim().toUpperCase();
};

export class SendOtpDto {
  /** Email address, or mobile number in international format (+countrycode). */
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  identifier: string;

  @IsEnum(OtpPurpose)
  purpose: OtpPurpose;
}

export class VerifyOtpDto extends SendOtpDto {
  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestCartToken?: string;
}

/** Account details. Checked by /signup/validate before any code is sent, and again by /signup. */
export class SignupDetailsDto {
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Full name must be 2 to 100 characters' })
  fullName: string;

  @Transform(toEmail)
  @IsEmail({}, { message: 'Enter a valid email address' })
  @MaxLength(254)
  email: string;

  @Transform(toPhone)
  @IsPhoneNumber(undefined, { message: 'Enter a valid mobile number with country code' })
  mobile: string;

  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  password: string;

  @Transform(optionalUpper)
  @IsOptional()
  @IsISO31661Alpha2()
  country?: string;

  @Transform(optionalUpper)
  @IsOptional()
  @Matches(/^[A-Z0-9]{6,12}$/, { message: 'Referral code is not valid' })
  referralCode?: string;

  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;

  @IsOptional()
  @IsBoolean()
  marketingOptIn?: boolean;

  @Equals(true, { message: 'You must accept the Terms of Service and Privacy Policy' })
  acceptTerms: boolean;
}

export class SignupDto extends SignupDetailsDto {
  @IsString()
  emailVerificationToken: string;

  @IsString()
  mobileVerificationToken: string;
}

export class LoginDto {
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  identifier: string;

  @IsString()
  @MaxLength(72)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  guestCartToken?: string;
}

export class ForgotPasswordDto {
  @Transform(trim)
  @IsString()
  @MaxLength(254)
  identifier: string;
}

export class ResetPasswordDto {
  @IsString()
  verificationToken: string;

  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
