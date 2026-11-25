import type { Product } from '../types';
import { Icon } from './primitives';
export function policyItems(p?: Product['policies']) {
  if (!p) return [];
  return [
    p.returns && ['Returns', p.returns],
    p.warranty && ['Warranty', p.warranty],
    p.cod && ['Cash on delivery', 'At eligible pincodes'],
    p.freeDelivery && ['Free delivery', 'On this product'],
    p.escrow && ['Escrow protection', 'Protected purchase'],
    p.authenticity && ['Authenticity', 'Authenticity assured'],
    p.securePayments && ['Secure payments', 'Protected checkout'],
  ].filter((v): v is string[] => Boolean(v));
}
export function PolicyCards({
  policies,
  compact = false,
}: {
  policies?: Product['policies'];
  compact?: boolean;
}) {
  const items = policyItems(policies);
  if (!items.length) return null;
  return (
    <div className={compact ? 'flex flex-wrap gap-2' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
      {items.map(([label, detail]) => (
        <div
          key={label}
          className={
            compact
              ? 'rounded-lg bg-teal-50 px-2 py-1 text-xs text-teal-800'
              : 'flex gap-3 rounded-xl bg-slate-50 p-4'
          }
        >
          {!compact && (
            <span className="text-teal-700">
              <Icon name="shield" />
            </span>
          )}
          <div>
            <p className="font-medium">{label}</p>
            {!compact && <p className="mt-1 text-sm text-slate-600">{detail}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
