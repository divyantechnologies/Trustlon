/**
 * Automatic checks every review passes before it is published (spec 3.7). A review that trips
 * any check is held for a moderator (Admin > Trust and safety, 5.8) instead of going live.
 */

export type ReviewFlag =
  | 'CONTAINS_CONTACT'
  | 'CONTAINS_LINK'
  | 'TOO_SHORT'
  | 'SHOUTING'
  | 'REPEATED_CHARACTERS'
  | 'DUPLICATE_TEXT'
  | 'BURST_POSTING';

export interface ReviewCheckInput {
  rating: number;
  title: string;
  body: string;
  /** Normalised bodies of the customer's other reviews. */
  otherBodies: string[];
  /** Reviews the customer saved in the last hour, including edits. */
  recentCount: number;
}

export const BURST_LIMIT_PER_HOUR = 5;

const URL_PATTERN = /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|in|net|org|io|co|shop|store)\b/i;
const PHONE_PATTERN = /(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/;
const EMAIL_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]{2,}/;

export function normaliseReviewText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ऀ-ॿ]+/g, ' ')
    .trim();
}

export function runReviewChecks(input: ReviewCheckInput): ReviewFlag[] {
  const flags = new Set<ReviewFlag>();
  const text = `${input.title} ${input.body}`;
  const letters = input.body.replace(/[^A-Za-z]/g, '');

  if (PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text)) flags.add('CONTAINS_CONTACT');
  if (URL_PATTERN.test(text)) flags.add('CONTAINS_LINK');
  // Very low or very high ratings with almost no text are the most common fake pattern.
  if (normaliseReviewText(input.body).length < 20 && (input.rating === 1 || input.rating === 5)) {
    flags.add('TOO_SHORT');
  }
  if (letters.length >= 20 && letters.replace(/[^A-Z]/g, '').length / letters.length > 0.7) {
    flags.add('SHOUTING');
  }
  if (/(.)\1{5,}/.test(text)) flags.add('REPEATED_CHARACTERS');
  const body = normaliseReviewText(input.body);
  if (body.length >= 20 && input.otherBodies.includes(body)) flags.add('DUPLICATE_TEXT');
  if (input.recentCount >= BURST_LIMIT_PER_HOUR) flags.add('BURST_POSTING');

  return [...flags];
}
