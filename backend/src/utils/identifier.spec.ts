import {
  normalizeEmail,
  normalizeIndianMobile,
  normalizeMobile,
  normalizePhone,
  parseIdentifier,
  PERSON_NAME,
  phoneRegion,
} from './identifier';

describe('identifier utils', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+1 (213) 373-4253', '+12133734253'],
    ['+44 7911 123456', '+447911123456'],
    ['5876543210', null],
    ['98765', null],
    ['', null],
  ])('normalizePhone(%s) = %s', (input, expected) => {
    expect(normalizePhone(input)).toBe(expected);
  });

  it.each([
    ['9876543210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['91 98765-43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+1 213 373 4253', null],
    ['5876543210', null],
    ['987654321', null],
    ['98765432100', null],
  ])('normalizeIndianMobile(%s) = %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it('reads the region of an E.164 number', () => {
    expect(phoneRegion('+447911123456')).toBe('GB');
  });

  it.each([
    ['  Anil@Trustlon.COM ', 'anil@trustlon.com'],
    ['first.last+shop@mail.co.in', 'first.last+shop@mail.co.in'],
    ['not-an-email', null],
    ['a@b', null],
    ['a..b@example.com', null],
    ['.a@example.com', null],
    ['a@example.c0m', null],
    ['a b@example.com', null],
    ['a@-example.com', null],
  ])('normalizeEmail(%s) = %s', (input, expected) => {
    expect(normalizeEmail(input)).toBe(expected);
  });

  it.each([
    ['98765 43210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['+44 7911 123456', '+447911123456'],
    ['+91 22 2345 6789', null],
    ['5876543210', null],
  ])('normalizeMobile(%s) = %s', (input, expected) => {
    expect(normalizeMobile(input)).toBe(expected);
  });

  it('detects identifier type', () => {
    expect(parseIdentifier('98765 43210')).toEqual({ type: 'mobile', value: '+919876543210' });
    expect(parseIdentifier('+12133734253')).toEqual({ type: 'mobile', value: '+12133734253' });
    expect(parseIdentifier('a@b.in')).toEqual({ type: 'email', value: 'a@b.in' });
    expect(parseIdentifier('abc')).toBeNull();
  });

  it.each([
    ['Anil Kushwah', true],
    ["D'Souza", true],
    ['K. R. Narayanan', true],
    ['अनिल कुशवाह', true],
    ['முருகன்', true],
    ['Anil123', false],
    ['@nil', false],
    ['-Anil', false],
  ])('PERSON_NAME %s → %s', (name, ok) => {
    expect(PERSON_NAME.test(name)).toBe(ok);
  });
});
