import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { KycStatus, VendorDocumentType, VendorNoteKind, VendorStatus } from '@prisma/client';
import { AdminListQuery } from '../../../common/admin/admin-query';
import { OptionalReasonDto, ReasonDto } from '../shared';

const bool = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

export class VendorListQuery extends AdminListQuery {
  @IsOptional()
  @IsEnum(VendorStatus)
  status?: VendorStatus;

  @IsOptional()
  @IsEnum(KycStatus)
  kyc?: KycStatus;

  @IsOptional()
  @Transform(bool)
  @IsBoolean()
  underReview?: boolean;

  @IsOptional()
  @IsIn(['newest', 'name', 'trust', 'gmv'])
  sort?: 'newest' | 'name' | 'trust' | 'gmv';
}

export class KycQueueQuery {
  @IsOptional()
  @IsIn([KycStatus.SUBMITTED, KycStatus.MORE_INFO_REQUIRED])
  status?: KycStatus;
}

export class RejectKycDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one reason' })
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  reasons!: string[];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RequestDocumentsDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Choose at least one document' })
  @IsEnum(VendorDocumentType, { each: true })
  documents!: VendorDocumentType[];

  @IsString()
  @MinLength(3, { message: 'Tell the vendor what is missing' })
  @MaxLength(500)
  note!: string;
}

export class ApproveKycDto extends OptionalReasonDto {}

export class CommissionDto extends ReasonDto {
  /** Null removes the vendor rate, so the category rate applies again. */
  @ValidateIf((_, value) => value !== null)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(50)
  commissionPercent!: number | null;
}

export class ToggleDto extends ReasonDto {
  @IsBoolean()
  value!: boolean;
}

export class NoteDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  body!: string;

  @IsOptional()
  @IsEnum(VendorNoteKind)
  kind?: VendorNoteKind;
}

export const KYC_REJECTION_REASONS = [
  'PAN name does not match the bank account name',
  'GSTIN is inactive or cancelled',
  'GSTIN does not belong to this business',
  'Bank account could not be verified (penny-drop failed)',
  'Document is unclear or incomplete',
  'Business category is not allowed on Trustlon',
] as const;
