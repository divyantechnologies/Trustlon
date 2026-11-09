import { parsePhoneNumberFromString, type CountryCode } from 'libphonenumber-js';

export type Identifier = { type: 'mobile'; value: string } | { type: 'email'; value: string };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Region used when a number is entered without a +country code. */
export const DEFAULT_PHONE_REGION: CountryCode = 'IN';

/** Returns the number in E.164 format (e.g. +919876543210), or null if it is not a valid number. */
export function normalizePhone(input: unknown, defaultRegion: CountryCode = DEFAULT_PHONE_REGION): string | null {
  if (typeof input !== 'string' || input.trim() === '') return null;
  const phone = parsePhoneNumberFromString(input.trim(), defaultRegion);
  return phone && phone.isValid() ? phone.number : null;
}

/** ISO 3166-1 alpha-2 region of an E.164 number, e.g. "IN". */
export function phoneRegion(e164: string): string | null {
  return parsePhoneNumberFromString(e164)?.country ?? null;
}

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const value = input.trim().toLowerCase();
  return value.length <= 254 && EMAIL.test(value) ? value : null;
}

export function parseIdentifier(input: unknown): Identifier | null {
  if (typeof input !== 'string') return null;
  if (input.includes('@')) {
    const email = normalizeEmail(input);
    return email ? { type: 'email', value: email } : null;
  }
  const mobile = normalizePhone(input);
  return mobile ? { type: 'mobile', value: mobile } : null;
}
