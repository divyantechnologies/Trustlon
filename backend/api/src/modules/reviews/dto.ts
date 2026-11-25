import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';

export const MAX_REVIEW_PHOTOS = 5;
export const MAX_REVIEW_VIDEOS = 1;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateReviewDto {
  @IsUUID()
  orderItemId!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Choose a rating from 1 to 5 stars' })
  @Max(5, { message: 'Choose a rating from 1 to 5 stars' })
  rating!: number;

  @Transform(trim)
  @IsString()
  @Length(3, 100, { message: 'Write a title of 3 to 100 characters' })
  title!: string;

  @Transform(trim)
  @IsString()
  @Length(10, 2000, { message: 'Write at least 10 characters about the product' })
  body!: string;

  /** Ids from POST /reviews/media. */
  @IsArray()
  @ArrayMaxSize(MAX_REVIEW_PHOTOS + MAX_REVIEW_VIDEOS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds: string[] = [];
}

export class UpdateReviewDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(3, 100, { message: 'Write a title of 3 to 100 characters' })
  title?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(10, 2000, { message: 'Write at least 10 characters about the product' })
  body?: string;

  /** The full set of media to keep; leave out to keep the current media. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_REVIEW_PHOTOS + MAX_REVIEW_VIDEOS)
  @ArrayUnique()
  @IsUUID('4', { each: true })
  mediaIds?: string[];
}
