import {
  base32Decode,
  base32Encode,
  newRecoveryCodes,
  normaliseRecoveryCode,
  totpCode,
  verifyTotp,
} from './totp';
import { DataCipher } from './crypto';

describe('TOTP (RFC 6238)', () => {
  const secret = base32Encode(Buffer.from('12345678901234567890'));

  it('matches the RFC test vectors', () => {
    expect(totpCode(secret, Math.floor(59 / 30))).toBe('287082');
    expect(totpCode(secret, Math.floor(1111111109 / 30))).toBe('081804');
    expect(base32Decode(secret).toString()).toBe('12345678901234567890');
  });

  it('accepts the current code once and allows one step of drift', () => {
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 30_000);
    expect(verifyTotp(secret, totpCode(secret, step), 0, now)).toBe(step);
    expect(verifyTotp(secret, totpCode(secret, step - 1), 0, now)).toBe(step - 1);
    expect(verifyTotp(secret, totpCode(secret, step - 2), 0, now)).toBeNull();
    expect(verifyTotp(secret, totpCode(secret, step), step, now)).toBeNull();
    expect(verifyTotp(secret, 'abcdef', 0, now)).toBeNull();
  });

  it('makes recovery codes that normalise back', () => {
    const [code] = newRecoveryCodes(1);
    expect(code).toMatch(/^[A-Z2-7]{4}-[A-Z2-7]{4}$/);
    expect(normaliseRecoveryCode(code.toLowerCase().replace('-', ' '))).toBe(code);
  });
});

describe('DataCipher', () => {
  it('round-trips and detects tampering', () => {
    const cipher = new DataCipher('a'.repeat(32));
    const sealed = cipher.encrypt('rzp_live_secret');
    expect(sealed).not.toContain('rzp_live');
    expect(cipher.decrypt(sealed)).toBe('rzp_live_secret');
    expect(() => new DataCipher('b'.repeat(32)).decrypt(sealed)).toThrow();
  });
});
