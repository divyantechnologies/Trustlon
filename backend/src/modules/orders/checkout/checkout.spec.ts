import { createHmac } from 'node:crypto';
import { shippingTax } from './checkout.service';
import { validSignature } from './payments.service';
import { guestExpired } from '../cart/cart.service';
describe('Checkout rules', () => {
  it('splits inclusive GST using shipping state, with exact paise reconciliation', () => {
    expect(shippingTax(11800, 1800, 'Karnataka', 'Karnataka')).toEqual({ taxable: 10000, cgst: 900, sgst: 900, igst: 0, total: 1800 });
    expect(shippingTax(11800, 1800, 'Karnataka', 'Maharashtra')).toEqual({ taxable: 10000, cgst: 0, sgst: 0, igst: 1800, total: 1800 });
    const odd = shippingTax(11807, 1800, 'Delhi', 'Delhi');
    expect(odd.cgst + odd.sgst).toBe(odd.total);
  });
  it('accepts only the exact valid HMAC and rejects malformed signatures', () => {
    const body = 'order_test|pay_test', secret = 'test-secret';
    const signature = createHmac('sha256', secret).update(body).digest('hex');
    expect(validSignature(body, signature, secret)).toBe(true);
    expect(validSignature(body + 'x', signature, secret)).toBe(false);
    expect(validSignature(body, 'a', secret)).toBe(false);
    expect(validSignature(body, signature, '')).toBe(false);
  });
  it('expires a guest cart exactly at the 30-day boundary', () => {
    const created = Date.parse('2026-01-01T00:00:00Z');
    const cart = { expiresAt: new Date(created + 30 * 86400000) };
    expect(guestExpired(cart, new Date(cart.expiresAt.getTime() - 1))).toBe(false);
    expect(guestExpired(cart, cart.expiresAt)).toBe(true);
  });
});
