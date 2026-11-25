import type { CheckoutQuote } from '../types';
import { PriceSummary } from '../../cart/components/PriceSummary';
import { money } from '../../product/helpers';
export function OrderSummary({ quote }: { quote: CheckoutQuote }) {
  return <section className="space-y-5" aria-label="Order summary"><h2 className="text-xl font-semibold">Order summary</h2>{quote.cart.groups.map(group => <div key={group.vendorId} className="space-y-2"><h3 className="font-semibold">{group.vendorName}</h3>{group.items.map(item => <div key={item.id} className="flex justify-between gap-3 text-sm"><span>{item.title} × {item.quantity}</span><span className="shrink-0">{money(item.price * item.quantity / 100)}</span></div>)}</div>)}
    <PriceSummary summary={quote.summary} />
    {quote.shippingState && <dl className="space-y-2 border-t border-slate-200 pt-4 text-xs text-slate-500"><div className="flex justify-between"><dt>Place of supply</dt><dd>{quote.shippingState}</dd></div>{([['Taxable value', quote.tax.taxable], ['CGST', quote.tax.cgst], ['SGST', quote.tax.sgst], ['IGST', quote.tax.igst], ['GST included', quote.tax.total]] as const).map(([label, value]) => <div key={label} className="flex justify-between"><dt>{label}</dt><dd>{money(value / 100)}</dd></div>)}</dl>}
  </section>;
}
