import { BannerPlacement, HomeSectionKey } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsDate,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** A site path ("/browse/home") or an https URL. */
const LINK = /^(\/[^\s]*|https:\/\/[^\s]+)$/;

export class CreateBannerDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tagLabel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  eyebrow?: string;

  @IsString()
  @MaxLength(120)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsString()
  @MaxLength(40)
  ctaLabel: string;

  @Matches(LINK, { message: 'imageUrl must be a site path or an https URL' })
  imageUrl: string;

  @IsOptional()
  @Matches(LINK, { message: 'mobileImageUrl must be a site path or an https URL' })
  mobileImageUrl?: string;

  @Matches(LINK, { message: 'href must be a site path or an https URL' })
  @MaxLength(300)
  href: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateBannerDto {
  @IsOptional()
  @IsEnum(BannerPlacement)
  placement?: BannerPlacement;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  tagLabel?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(60)
  eyebrow?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(240)
  subtitle?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  ctaLabel?: string;

  @IsOptional()
  @Matches(LINK, { message: 'imageUrl must be a site path or an https URL' })
  imageUrl?: string;

  @IsOptional()
  @Matches(LINK, { message: 'mobileImageUrl must be a site path or an https URL' })
  mobileImageUrl?: string;

  @IsOptional()
  @Matches(LINK, { message: 'href must be a site path or an https URL' })
  @MaxLength(300)
  href?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  priority?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class HomeSectionDto {
  @IsEnum(HomeSectionKey)
  key: HomeSectionKey;

  @IsBoolean()
  isEnabled: boolean;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder: number;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;
}

export class UpdateHomeSectionsDto {
  @ValidateNested({ each: true })
  @Type(() => HomeSectionDto)
  @ArrayMaxSize(20)
  sections: HomeSectionDto[];
}

export class CreateDealDto {
  @IsUUID()
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  dealPricePaise: number;

  @Type(() => Date)
  @IsDate()
  startsAt: Date;

  @Type(() => Date)
  @IsDate()
  endsAt: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class UpdateDealDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dealPricePaise?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  startsAt?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  endsAt?: Date;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sortOrder?: number;
}

export class FeatureStoreDto {
  @IsBoolean()
  isFeatured: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  featuredOrder?: number;
}
