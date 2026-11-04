import {
  getCountries,
  getCountryCallingCode,
  parsePhoneNumberFromString,
  type CountryCode,
} from 'libphonenumber-js';

export type { CountryCode };

export const DEFAULT_COUNTRY: CountryCode = 'IN';

export interface CountryOption {
  code: CountryCode;
  name: string;
  dialCode: string;
}

const optionCache = new Map<string, CountryOption[]>();

/** All countries supported for phone numbers, sorted by name in the given UI language. */
export function countryOptions(locale: string): CountryOption[] {
  const cached = optionCache.get(locale);
  if (cached) return cached;

  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([locale], { type: 'region' });
  } catch {
    names = null;
  }

  const options = getCountries()
    .map((code) => ({
      code,
      name: names?.of(code) ?? code,
      dialCode: `+${getCountryCallingCode(code)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, locale));

  optionCache.set(locale, options);
  return options;
}

export function isCountryCode(value: string): value is CountryCode {
  return (getCountries() as string[]).includes(value);
}

/** Region from the browser locale (e.g. en-GB -> GB), falling back to India. */
export function detectCountry(): CountryCode {
  if (typeof navigator === 'undefined') return DEFAULT_COUNTRY;
  for (const tag of navigator.languages ?? [navigator.language]) {
    const region = tag.split('-')[1]?.toUpperCase();
    if (region && isCountryCode(region)) return region;
  }
  return DEFAULT_COUNTRY;
}

/** E.164 number (e.g. +919876543210) or null when the number is not valid for the country. */
export function toE164(national: string, country: CountryCode): string | null {
  if (!national.trim()) return null;
  const phone = parsePhoneNumberFromString(national.trim(), country);
  return phone && phone.isValid() ? phone.number : null;
}

/** Readable international format, e.g. +91 98765 43210. */
export function formatInternational(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
