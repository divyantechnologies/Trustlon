/** GST state codes (first two digits of a GSTIN) and their states. */
export const GST_STATE_CODES: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
};

export const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Check character of a GSTIN (the 15th character), using the GSTN mod-36 algorithm. */
export function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const value = CHARSET.indexOf(first14[i]);
    const product = value * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return CHARSET[(36 - (sum % 36)) % 36];
}

export interface GstinCheck {
  gstin: string;
  valid: boolean;
  /** Why the number is not valid. */
  reason: string | null;
  stateCode: string | null;
  state: string | null;
  pan: string | null;
}

/** Validates format, state code and check digit. This does not prove the GSTIN is active. */
export function checkGstin(input: string): GstinCheck {
  const gstin = input.trim().toUpperCase();
  const fail = (reason: string): GstinCheck => ({
    gstin,
    valid: false,
    reason,
    stateCode: null,
    state: null,
    pan: null,
  });
  if (!GSTIN_PATTERN.test(gstin)) return fail('A GSTIN has 15 characters, e.g. 29ABCDE1234F1Z5');
  const stateCode = gstin.slice(0, 2);
  const state = GST_STATE_CODES[stateCode];
  if (!state) return fail('The first two digits are not a valid GST state code');
  if (gstinCheckCharacter(gstin.slice(0, 14)) !== gstin[14]) {
    return fail('This GSTIN is not valid. Check it for typing mistakes.');
  }
  return { gstin, valid: true, reason: null, stateCode, state, pan: gstin.slice(2, 12) };
}
