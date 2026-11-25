'use client';

import type { CartView } from '../types';
import { number } from '../../product/helpers';

export function CoinsToggle({
  coins,
  busy,
  onChange,
}: {
  coins: CartView['coins'];
  busy: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 cursor-pointer items-center justify-between gap-4 border-y border-slate-200 py-4">
      <div>
        <span className="block font-semibold text-[#12203F]">Use Trustlon Coins</span>
        <span className="text-sm text-slate-500">
          {number(coins.balance)} coins available
        </span>
      </div>
      <input
        type="checkbox"
        role="switch"
        aria-label="Use Trustlon Coins"
        checked={coins.enabled}
        disabled={busy || !coins.balance}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-slate-300 accent-teal-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600"
      />
    </label>
  );
}
