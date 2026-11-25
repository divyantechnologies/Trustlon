import { Language, OtpPurpose } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsBoolean,
  IsEnum,
  IsIn,
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
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
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../auth.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);
const toEmail = ({ value }: { value: unknown }) => normalizeEmail(value) ?? value;
const toPhone = ({ value }: { value: unknown }) => normalizeMobile(value) ?? value;
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

  /** CHANGE_CONTACT codes are sent from Account settings (/me/contact/otp), never from here. */
  @IsIn([OtpPurpose.SIGNUP, OtpPurpose.LOGIN, OtpPurpose.RESET_PASSWORD], {
    message: 'purpose must be SIGNUP, LOGIN or RESET_PASSWORD',
  })
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
  @Matches(PERSON_NAME, { message: PERSON_NAME_MESSAGE })
  fullName: string;

  @Transform(toEmail)
  @Matches(EMAIL_PATTERN, { message: 'Enter a valid email address, e.g. name@example.com' })
  @MaxLength(254)
  email: string;

  @Transform(toPhone)
  @IsMobile({ message: MOBILE_RULE_MESSAGE })
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
