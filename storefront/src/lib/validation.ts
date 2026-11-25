import { toE164, type CountryCode } from '@/lib/phone';

/**
 * Field rules shared by every form in the storefront. The API checks the same rules, so a value
 * that passes here is not rejected later.
 */

/** Same rule as the API: sensible local part, real-looking domain, letters-only TLD. */
export const EMAIL_PATTERN =
  /^(?!\.)(?!.*\.\.)[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]{1,64}(?<!\.)@(?=.{4,253}$)([A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,63}$/;

export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());

/** Names in any script, with spaces, dots, apostrophes and hyphens; no digits or symbols. */
export const PERSON_NAME = /^[\p{L}\p{M}][\p{L}\p{M} .'’-]*[\p{L}\p{M}.]$/u;

export const isValidName = (value: string) => {
  const name = value.trim();
  return name.length >= 2 && name.length <= 100 && PERSON_NAME.test(name);
};

/** Indian mobile: 10 digits starting 6 to 9, typed with or without +91 / 0. */
export function toIndianMobile(input: string): string | null {
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(input.replace(/[\s()-]/g, ''));
  return match ? `+91${match[1]}` : null;
}

/** Keeps only the 10 national digits while typing or pasting (+91 98765 43210 → 9876543210). */
export function mobileDigits(input: string): string {
  let digits = input.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

/**
 * National digits while typing, for any country. India keeps 10 digits (a pasted +91 or 0 is
 * dropped); other countries drop their pasted calling code and allow up to 14 digits.
 */
export function phoneDigits(input: string, country: string, dialCode: string): string {
  if (country === 'IN') return mobileDigits(input);
  let digits = input.replace(/\D/g, '');
  const code = dialCode.replace(/\D/g, '');
  if (input.trim().startsWith('+') && code && digits.startsWith(code))
    digits = digits.slice(code.length);
  return digits.slice(0, 14);
}

/**
 * Full number in international format (+919876543210) or null. India accepts mobile numbers
 * only (10 digits starting 6 to 9); other countries follow that country's numbering plan.
 */
export function toMobileE164(national: string, country: string): string | null {
  if (country === 'IN') return toIndianMobile(national);
  const number = toE164(national, country as CountryCode);
  // A number that parses into India must still be an Indian mobile.
  if (number?.startsWith('+91')) return toIndianMobile(number);
  return number;
}

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const POPULAR_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'yahoo.co.in',
  'yahoo.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'rediffmail.com',
  'protonmail.com',
];

function distance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
    }
  }
  return dp[a.length][b.length];
}

/**
 * Catches common domain typos (gmial.com, gmail.con, yaho.co.in). Returns the corrected email,
 * or null when the domain looks fine.
 */
export function suggestEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  const at = email.lastIndexOf('@');
  if (at < 1) return null;
  const domain = email.slice(at + 1);
  if (!domain || POPULAR_DOMAINS.includes(domain)) return null;
  let best: string | null = null;
  let bestDistance = 3;
  for (const candidate of POPULAR_DOMAINS) {
    const d = distance(domain, candidate);
    if (d < bestDistance) {
      best = candidate;
      bestDistance = d;
    }
  }
  return best && bestDistance <= 2 ? `${email.slice(0, at)}@${best}` : null;
}
