import type { PriceSummaryView } from '../types';
import { money } from '../../product/helpers';

export function PriceSummary({
  summary,
  compact = false,
}: {
  summary: PriceSummaryView;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <span className="block text-xs text-slate-500">Total payable</span>
          <span className="text-lg font-bold text-[#12203F]">
            {money(summary.totalPayable / 100)}
          </span>
        </div>
        {summary.discount + summary.couponDiscount > 0 && (
          <span className="text-xs font-medium text-teal-700">
            You save {money((summary.discount + summary.couponDiscount) / 100)}
          </span>
        )}
      </div>
    );
  }

  const lines = [
    { label: 'Items total', value: summary.itemsTotal, negative: false, isFree: false },
    { label: 'Discount', value: summary.discount, negative: true, isFree: false },
    { label: 'Coupon', value: summary.couponDiscount, negative: true, isFree: false },
    {
      label: 'Delivery fee',
      value: summary.deliveryFee,
      negative: false,
      isFree: summary.deliveryFee === 0,
    },
    { label: 'Coins used', value: summary.coinsUsed, negative: true, isFree: false },
  ];

  return (
    <dl className="space-y-3 text-sm text-[#12203F]" aria-label="Price summary">
      {lines.map(
        ({ label, value, negative, isFree }) =>
          (value > 0 || isFree) && (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-slate-500">{label}</dt>
              <dd className={negative ? 'font-medium text-teal-700' : 'font-medium'}>
                {isFree
                  ? 'FREE'
                  : `${negative ? '−' : ''}${money(value / 100)}`}
              </dd>
            </div>
          ),
      )}
      <div className="flex justify-between gap-3 border-t border-slate-200 pt-4 font-semibold text-base text-[#12203F]">
        <dt>Total payable</dt>
        <dd>{money(summary.totalPayable / 100)}</dd>
      </div>
    </dl>
  );
}
