'use client';

import { useState } from 'react';
import type { CartView } from '../types';
import { field, secondary } from '../../product/components/primitives';

export function CouponInput({
  coupon,
  busy,
  onApply,
}: {
  coupon: CartView['coupon'];
  busy: boolean;
  onApply: (code: string | null) => Promise<CartView | undefined>;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  async function apply(value: string | null) {
    try {
      setIsError(false);
      const cart = await onApply(value);
      if (value) {
        setCode('');
        setMessage(cart?.coupon?.message ?? 'Coupon applied successfully.');
      } else {
        setMessage('Coupon removed.');
      }
    } catch (e) {
      setIsError(true);
      setMessage(e instanceof Error ? e.message : 'Please try again.');
    }
  }

  return (
    <div className="space-y-3">
      <label htmlFor="cart-coupon" className="block text-sm font-semibold text-[#12203F]">
        Apply Coupon
      </label>
      {coupon ? (
        <div className="flex items-center justify-between rounded-xl border border-teal-200 bg-teal-50/50 p-3">
          <div>
            <span className="block font-semibold text-teal-900">{coupon.code}</span>
            <span className="text-xs text-teal-700">{coupon.message}</span>
          </div>
          <button
            type="button"
            disabled={busy}
            className={secondary}
            onClick={() => void apply(null)}
            aria-label={`Remove coupon ${coupon.code}`}
          >
            Remove
          </button>
        </div>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void apply(code.trim().toUpperCase());
          }}
          className="flex gap-2"
        >
          <input
            id="cart-coupon"
            className={`${field} uppercase`}
            value={code}
            maxLength={40}
            pattern="[A-Za-z0-9_-]+"
            required
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter coupon code"
            aria-label="Coupon code"
          />
          <button
            type="submit"
            className={secondary}
            disabled={busy || !code.trim()}
          >
            Apply
          </button>
        </form>
      )}
      {(message || (coupon && !message)) && (
        <p
          role="status"
          className={`text-sm ${isError ? 'text-rose-600' : 'text-teal-700'}`}
        >
          {message || coupon?.message}
        </p>
      )}
    </div>
  );
}
