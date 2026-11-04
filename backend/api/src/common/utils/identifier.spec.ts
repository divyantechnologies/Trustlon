import { normalizeEmail, normalizePhone, parseIdentifier, phoneRegion } from './identifier';

describe('identifier utils', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+1 (213) 373-4253', '+12133734253'],
    ['+44 7911 123456', '+447911123456'],
    ['+971 50 123 4567', '+971501234567'],
    ['5876543210', null],
    ['98765', null],
    ['', null],
  ])('normalizePhone(%s) = %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it('reads the region of an E.164 number', () => {
    expect(phoneRegion('+447911123456')).toBe('GB');
  });

  it('normalizes email to lower case', () => {
    expect(normalizeEmail('  Anil@Trustlon.COM ')).toBe('anil@trustlon.com');
    expect(normalizeEmail('not-an-email')).toBeNull();
  });

  it('detects identifier type', () => {
    expect(parseIdentifier('+12133734253')).toEqual({ type: 'mobile', value: '+12133734253' });
    expect(parseIdentifier('a@b.in')).toEqual({ type: 'email', value: 'a@b.in' });
    expect(parseIdentifier('abc')).toBeNull();
  });
});
