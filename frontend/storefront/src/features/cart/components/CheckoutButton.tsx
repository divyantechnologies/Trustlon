'use client';

import type { CartGroupView } from '../types';
import { button } from '../../product/components/primitives';

export function CheckoutButton({
  groups,
  busy = false,
  onCheckout,
}: {
  groups: CartGroupView[];
  busy?: boolean;
  onCheckout: () => void;
}) {
  const items = groups.flatMap((g) => g.items);
  const hasOutOfStock = items.some(
    (i) => i.stockStatus === 'out' || !i.available || i.maxQuantity === 0 || i.quantity > i.maxQuantity,
  );
  const disabled = busy || !items.length || hasOutOfStock;

  return (
    <button
      type="button"
      className={`${button} w-full`}
      disabled={disabled}
      onClick={onCheckout}
      aria-label="Proceed to checkout"
    >
      Proceed to checkout
    </button>
  );
}
