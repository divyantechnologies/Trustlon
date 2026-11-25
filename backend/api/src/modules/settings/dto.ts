import { Gender, Language } from '@prisma/client';
import { Transform } from 'class-transformer';
import {
  Equals,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PERSON_NAME, PERSON_NAME_MESSAGE } from '../../common/utils/identifier';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../auth/auth.constants';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(2, 100, { message: 'Full name must be 2 to 100 characters' })
  @Matches(PERSON_NAME, { message: PERSON_NAME_MESSAGE })
  fullName?: string;

  /** YYYY-MM-DD, or null to remove it. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Enter a valid date of birth' })
  dateOfBirth?: string | null;

  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsEnum(Gender)
  gender?: Gender | null;

  @IsOptional()
  @IsEnum(Language)
  preferredLanguage?: Language;
}

export class ContactOtpDto {
  @IsIn(['email', 'mobile'])
  type!: 'email' | 'mobile';

  @Transform(trim)
  @IsString()
  @MaxLength(254)
  value!: string;

  /** Required when the account has a password, so a borrowed session can't take the account. */
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;
}

export class ContactVerifyDto {
  @IsIn(['email', 'mobile'])
  type!: 'email' | 'mobile';

  @Transform(trim)
  @IsString()
  @MaxLength(254)
  value!: string;

  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code!: string;
}

export class ChangePasswordDto {
  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;

  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}

export class NotificationPreferencesDto {
  /** { [event]: { sms?, email?, whatsapp?, push? } }. Checked against the known keys in the service. */
  @IsObject()
  channels!: Record<string, Record<string, boolean>>;
}

export class DeleteAccountDto {
  @Equals('DELETE', { message: 'Type DELETE to confirm' })
  confirm!: string;

  @IsOptional()
  @IsString()
  @MaxLength(72)
  currentPassword?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(300)
  reason?: string;
}
