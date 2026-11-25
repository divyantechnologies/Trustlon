import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export type Identifier = { type: 'mobile'; value: string } | { type: 'email'; value: string };

/**
 * Practical email check: one @, a local part up to 64 characters without spaces or leading,
 * trailing or double dots, and a domain with a letter-only top-level domain (e.g. .in, .com).
 */
export const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}(?<!\.)@(?=.{4,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

/** Region used when a number is entered without a +country code. */
export const DEFAULT_PHONE_REGION: CountryCode = 'IN';

/** Indian mobile numbers: +91 then 10 digits starting with 6, 7, 8 or 9. */
export const INDIAN_MOBILE = /^\+91[6-9]\d{9}$/;

/** Returns the number in E.164 format (e.g. +919876543210), or null if it is not a valid number. */
export function normalizePhone(input: unknown, defaultRegion: CountryCode = DEFAULT_PHONE_REGION): string | null {
  if (typeof input !== 'string' || input.trim() === '') return null;
  const phone = parsePhoneNumberFromString(input.trim(), defaultRegion);
  return phone && phone.isValid() ? phone.number : null;
}

/**
 * Customer accounts use Indian mobile numbers only. Accepts 10 digits, 0 + 10 digits,
 * or +91 / 91 + 10 digits, with spaces or dashes. Returns +91XXXXXXXXXX or null.
 */
export function normalizeIndianMobile(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const digits = input.replace(/[\s()-]/g, '');
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? `+91${match[1]}` : null;
}

/**
 * Customer mobile numbers: Indian by default (10 digits starting 6 to 9, with or without +91 or 0),
 * or any valid mobile number written with its +country code. Returns E.164 or null.
 */
export function normalizeMobile(input: unknown): string | null {
  if (typeof input !== 'string' || input.trim() === '') return null;
  const raw = input.trim();
  if (!raw.startsWith('+')) return normalizeIndianMobile(raw);
  const e164 = normalizePhone(raw);
  if (!e164) return null;
  return e164.startsWith('+91') ? normalizeIndianMobile(e164) : e164;
}

export const MOBILE_RULE_MESSAGE =
  'Enter a valid mobile number (10 digits for India, or with the country code)';

/** ISO 3166-1 alpha-2 region of an E.164 number, e.g. "IN". */
export function phoneRegion(e164: string): string | null {
  return parsePhoneNumberFromString(e164)?.country ?? null;
}

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  return value.length <= 254 && EMAIL_PATTERN.test(value) ? value : null;
}

export function parseIdentifier(input: unknown): Identifier | null {
  if (typeof input !== 'string') return null;
  if (input.includes('@')) {
    const email = normalizeEmail(input);
    return email ? { type: 'email', value: email } : null;
  }
  const mobile = normalizeMobile(input);
  return mobile ? { type: 'mobile', value: mobile } : null;
}

/**
 * Names in any script (Hindi, Tamil, Latin and so on), with spaces, dots, apostrophes and
 * hyphens. No digits or other symbols.
 */
export const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*[\p{L}\p{M}.]$/u;
export const PERSON_NAME_MESSAGE = 'Use letters only (spaces, dots, apostrophes and hyphens are fine)';
