import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_RULE_MESSAGE } from '../auth/auth.constants';

const lower = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class StaffLoginDto {
  @Transform(lower)
  @IsEmail({}, { message: 'Enter your work email address' })
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(1, { message: 'Enter your password' })
  @MaxLength(72)
  password!: string;
}

export class ChallengeDto {
  @IsString()
  @MaxLength(2000)
  challengeToken!: string;
}

export class NewPasswordDto extends ChallengeDto {
  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}

export class TotpDto extends ChallengeDto {
  @IsOptional()
  @IsString()
  @Matches(/^\s*\d{3}\s?\d{3}\s*$/, {
    message: 'Enter the 6-digit code from your authenticator app',
  })
  code?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z0-9]{4}-?[A-Za-z0-9]{4}$/, { message: 'Enter a recovery code like ABCD-EFGH' })
  recoveryCode?: string;
}

export class ChangeOwnPasswordDto {
  @IsString()
  @MaxLength(72)
  currentPassword!: string;

  @IsString()
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_RULE_MESSAGE })
  newPassword!: string;
}

export class CodeDto {
  @IsString()
  @Matches(/^\s*\d{3}\s?\d{3}\s*$/, {
    message: 'Enter the 6-digit code from your authenticator app',
  })
  code!: string;
}
