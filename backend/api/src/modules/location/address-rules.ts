import { COUNTRIES, SUBDIVISIONS } from './data/iso-3166.data';

/**
 * Address rules per country: what the postal code is called, its format, and whether a state
 * or province is part of the address. Countries not listed use a loose 2 to 10 character check.
 * The storefront uses the same table (GET /location/countries), so both sides agree.
 */
export interface PostalRule {
  /** What people in that country call it. */
  label: string;
  pattern: RegExp;
  example: string;
}

const rule = (label: string, pattern: RegExp, example: string): PostalRule => ({
  label,
  pattern,
  example,
});

export const POSTAL_RULES: Record<string, PostalRule> = {
  IN: rule('Pincode', /^[1-9][0-9]{5}$/, '560001'),
  US: rule('ZIP code', /^\d{5}(-\d{4})?$/, '94105'),
  CA: rule(
    'Postal code',
    /^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z] ?\d[ABCEGHJ-NPRSTV-Z]\d$/i,
    'K1A 0B1',
  ),
  GB: rule('Postcode', /^(GIR ?0AA|[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2})$/i, 'SW1A 1AA'),
  AU: rule('Postcode', /^\d{4}$/, '2000'),
  NZ: rule('Postcode', /^\d{4}$/, '6011'),
  AE: rule('Postal code', /^\d{0,6}$/, ''),
  SA: rule('Postal code', /^\d{5}(-\d{4})?$/, '11564'),
  QA: rule('Postal code', /^\d{0,6}$/, ''),
  KW: rule('Postal code', /^\d{5}$/, '13001'),
  OM: rule('Postal code', /^\d{3}$/, '112'),
  BH: rule('Postal code', /^\d{3,4}$/, '317'),
  SG: rule('Postal code', /^\d{6}$/, '018956'),
  MY: rule('Postcode', /^\d{5}$/, '50050'),
  TH: rule('Postal code', /^\d{5}$/, '10200'),
  ID: rule('Postal code', /^\d{5}$/, '10110'),
  PH: rule('ZIP code', /^\d{4}$/, '1000'),
  VN: rule('Postal code', /^\d{6}$/, '100000'),
  CN: rule('Postal code', /^\d{6}$/, '100000'),
  HK: rule('Postal code', /^$/, ''),
  JP: rule('Postal code', /^\d{3}-?\d{4}$/, '100-0001'),
  KR: rule('Postal code', /^\d{5}$/, '03187'),
  TW: rule('Postal code', /^\d{3}(\d{2,3})?$/, '100'),
  NP: rule('Postal code', /^\d{5}$/, '44600'),
  BD: rule('Postal code', /^\d{4}$/, '1000'),
  LK: rule('Postal code', /^\d{5}$/, '00100'),
  PK: rule('Postal code', /^\d{5}$/, '44000'),
  BT: rule('Postal code', /^\d{5}$/, '11001'),
  MV: rule('Postal code', /^\d{5}$/, '20026'),
  DE: rule('Postleitzahl', /^\d{5}$/, '10115'),
  FR: rule('Code postal', /^\d{5}$/, '75001'),
  IT: rule('CAP', /^\d{5}$/, '00118'),
  ES: rule('Código postal', /^\d{5}$/, '28001'),
  PT: rule('Código postal', /^\d{4}-\d{3}$/, '1000-001'),
  NL: rule('Postcode', /^\d{4} ?[A-Z]{2}$/i, '1012 AB'),
  BE: rule('Postcode', /^\d{4}$/, '1000'),
  CH: rule('Postleitzahl', /^\d{4}$/, '8001'),
  AT: rule('Postleitzahl', /^\d{4}$/, '1010'),
  IE: rule('Eircode', /^[AC-FHKNPRTV-Y]\d{2}[ ]?[0-9AC-FHKNPRTV-Y]{4}$/i, 'D02 X285'),
  SE: rule('Postnummer', /^\d{3} ?\d{2}$/, '111 22'),
  NO: rule('Postnummer', /^\d{4}$/, '0150'),
  DK: rule('Postnummer', /^\d{4}$/, '1050'),
  FI: rule('Postinumero', /^\d{5}$/, '00100'),
  PL: rule('Kod pocztowy', /^\d{2}-\d{3}$/, '00-001'),
  CZ: rule('PSČ', /^\d{3} ?\d{2}$/, '110 00'),
  RU: rule('Postal code', /^\d{6}$/, '101000'),
  TR: rule('Posta kodu', /^\d{5}$/, '34000'),
  IL: rule('Postal code', /^\d{7}$/, '6100000'),
  ZA: rule('Postal code', /^\d{4}$/, '0001'),
  KE: rule('Postal code', /^\d{5}$/, '00100'),
  NG: rule('Postal code', /^\d{6}$/, '100001'),
  EG: rule('Postal code', /^\d{5}$/, '11511'),
  BR: rule('CEP', /^\d{5}-?\d{3}$/, '01310-100'),
  MX: rule('Código postal', /^\d{5}$/, '06000'),
  AR: rule('Código postal', /^([A-Z]\d{4}[A-Z]{3}|\d{4})$/i, 'C1002AAP'),
};

const DEFAULT_RULE = rule('Postal code', /^[A-Z0-9][A-Z0-9 -]{1,9}$/i, '');

/** Countries where couriers need the state or province on the label. */
export const STATE_REQUIRED = new Set([
  'IN',
  'US',
  'CA',
  'AU',
  'BR',
  'MX',
  'CN',
  'JP',
  'MY',
  'AR',
  'ID',
]);

/** States and union territories of India, as written on Indian addresses. */
export const INDIAN_STATES = [
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const;

const COUNTRY_CODES = new Set(COUNTRIES.map(([code]) => code));

export const isCountryCode = (code: string) => COUNTRY_CODES.has(code);

export function postalRule(country: string): PostalRule {
  return POSTAL_RULES[country] ?? DEFAULT_RULE;
}

/** Upper-cases and tidies spaces; returns null when the code doesn't fit the country's format. */
export function normalisePostalCode(country: string, raw: string): string | null {
  const value = raw.trim().toUpperCase().replace(/\s+/g, ' ');
  return postalRule(country).pattern.test(value) ? value : null;
}

/** State or province names for a country. India uses the official list above. */
export function statesOf(country: string): string[] {
  if (country === 'IN') return [...INDIAN_STATES];
  return (SUBDIVISIONS[country] ?? []).map(([, name]) => name);
}

export function countryList() {
  return COUNTRIES.map(([code, name]) => {
    const postal = postalRule(code);
    return {
      code,
      name,
      postalLabel: postal.label,
      postalPattern: postal.pattern.source,
      postalExample: postal.example,
      hasStates: statesOf(code).length > 0,
      stateRequired: STATE_REQUIRED.has(code),
    };
  });
}
