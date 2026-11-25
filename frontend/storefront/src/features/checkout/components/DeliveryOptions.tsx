import type { CheckoutQuote, DeliveryMethod } from '../types';
import { money } from '../../product/helpers';
export function DeliveryOptions({ group, onChange }: { group: CheckoutQuote['deliveryGroups'][number]; onChange: (method: DeliveryMethod) => void }) {
  return <fieldset className="space-y-3"><legend className="mb-3 font-semibold">{group.vendorName}</legend>{group.options.map(option => <label key={option.method} className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 p-4"><input type="radio" name={`delivery-${group.vendorId}`} checked={group.selected === option.method} onChange={() => onChange(option.method)} className="accent-teal-700 focus-visible:ring-2 focus-visible:ring-teal-600" /><span className="flex-1"><span className="capitalize">{option.method}</span><span className="block text-xs text-slate-500">{option.estimate}</span></span><span>{money(option.fee / 100)}</span></label>)}</fieldset>;
}
