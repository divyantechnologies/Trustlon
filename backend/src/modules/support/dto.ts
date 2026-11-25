import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { TicketCategory } from '@prisma/client';
import { PageQueryDto } from '../../utils/http/pagination';

export const MAX_TICKET_ATTACHMENTS = 3;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

export class CreateTicketDto {
  @IsIn(Object.values(TicketCategory))
  category!: TicketCategory;

  @Transform(trim)
  @IsString()
  @Length(5, 120, { message: 'Write a subject of 5 to 120 characters' })
  subject!: string;

  /** The order this is about, if any. */
  @IsOptional()
  @IsUUID()
  orderId?: string;

  @Transform(trim)
  @IsString()
  @Length(20, 4000, { message: 'Describe the problem in at least 20 characters' })
  description!: string;

  @IsArray()
  @ArrayMaxSize(MAX_TICKET_ATTACHMENTS, { message: `Add up to ${MAX_TICKET_ATTACHMENTS} files` })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentIds: string[] = [];
}

export class TicketMessageDto {
  @Transform(trim)
  @IsString()
  @Length(1, 4000, { message: 'Write a message' })
  body!: string;

  @IsArray()
  @ArrayMaxSize(MAX_TICKET_ATTACHMENTS, { message: `Add up to ${MAX_TICKET_ATTACHMENTS} files` })
  @ArrayUnique()
  @IsUUID('4', { each: true })
  attachmentIds: string[] = [];
}

export const TICKET_LIST_FILTERS = ['open', 'resolved'] as const;

export class TicketListQueryDto extends PageQueryDto {
  /** open: anything still being worked on; resolved: resolved or closed. */
  @IsOptional()
  @IsIn(TICKET_LIST_FILTERS)
  status?: (typeof TICKET_LIST_FILTERS)[number];
}
