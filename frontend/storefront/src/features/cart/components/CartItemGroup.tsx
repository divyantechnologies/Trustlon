import type { CartChanges, CartGroupView } from '../types';
import { card } from '../../product/components/primitives';
import { CartItemRow } from './CartItemRow';

export function CartItemGroup({
  group,
  busy,
  onChange,
  onRemove,
}: {
  group: CartGroupView;
  busy: boolean;
  onChange: (id: string, changes: CartChanges) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <section className={card} aria-label={`Items from ${group.vendorName}`}>
      <div className="border-b border-slate-100 pb-3">
        <h2 className="text-lg font-semibold text-[#12203F]">{group.vendorName}</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {group.expectedDelivery ?? 'Delivery estimate after selecting your address'}
        </p>
      </div>
      <div className="divide-y divide-slate-100">
        {group.items.map((item) => (
          <CartItemRow
            key={item.id}
            item={item}
            busy={busy}
            onChange={onChange}
            onRemove={onRemove}
          />
        ))}
      </div>
    </section>
  );
}
