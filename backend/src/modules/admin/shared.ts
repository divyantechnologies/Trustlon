import { BadRequestException } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

/** A required reason (audit log, customer and vendor messages). */
export class ReasonDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(3, { message: 'Add a short reason' })
  @MaxLength(500)
  reason!: string;
}

export class OptionalReasonDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(500)
  reason?: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export class DateRangeQuery {
  @IsOptional()
  @Matches(DATE, { message: 'Use YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(DATE, { message: 'Use YYYY-MM-DD' })
  to?: string;
}

const IST_OFFSET_MS = 330 * 60_000;

/** Start of an India calendar day as a UTC Date. */
export function istDayStart(date: string): Date {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) - IST_OFFSET_MS);
}

/** Today's date in India, as YYYY-MM-DD. */
export function istToday(now = new Date()): string {
  return new Date(now.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

/** Inclusive from/to dates (India time) → [start, end) instants. Defaults to the last 30 days. */
export function resolveRange(query: DateRangeQuery, maxDays = 366) {
  const to = query.to ?? istToday();
  const from = query.from ?? addDays(to, -29);
  const start = istDayStart(from);
  const end = istDayStart(addDays(to, 1));
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  if (days < 1)
    throw new BadRequestException({
      statusCode: 400,
      message: 'The start date must be before the end date',
      field: 'from',
    });
  if (days > maxDays)
    throw new BadRequestException({
      statusCode: 400,
      message: `Choose ${maxDays} days or fewer`,
      field: 'from',
    });
  return { from, to, start, end, days };
}

export const rupees = (paise: number | bigint | null | undefined) => Number(paise ?? 0) / 100;
