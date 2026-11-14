'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, cn, Dialog, focusRing, TextField } from '@/design-system';
import type { Product } from '@/features/home/types';
import { ApiError } from '@/lib/http';
import { accountApi } from '../api';
import { formatMoney, rupeesToPaise } from '../format';
import type { PriceAlert } from '../types';

const QUICK_DROPS = [5, 10, 20];

/** Suggested target: 10% below today's price, rounded down to whole rupees. */
const suggest = (pricePaise: number, percent: number) =>
  Math.floor((pricePaise * (100 - percent)) / 10_000) * 100;

/** Create or change a price alert for one product. */
export function PriceAlertDialog({
  product,
  current,
  open,
  onClose,
  onSaved,
}: {
  product: Product;
  /** The existing alert for this product, if any. */
  current: PriceAlert | null;
  open: boolean;
  onClose: () => void;
  onSaved: (items: PriceAlert[]) => void;
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const start = current?.targetPricePaise ?? suggest(product.pricePaise, 10);
    setValue(String(start / 100));
    setError(null);
  }, [open, current, product.pricePaise]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = rupeesToPaise(value);
    if (target === null || target < 100) {
      setError('Enter a price in rupees, e.g. 1499');
      return;
    }
    if (target >= product.pricePaise) {
      setError(`Enter a price below today’s ${formatMoney(product.pricePaise)}`);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved((await accountApi.savePriceAlert(product.id, target)).items);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'We couldn’t save this alert. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title={current ? 'Change price alert' : 'Set a price alert'}
      onClose={onClose}
    >
      <form onSubmit={submit} noValidate className="space-y-5">
        <div>
          <p className="font-medium text-navy">{product.name}</p>
          <p className="mt-1 text-sm text-slate-500">
            Today’s price{' '}
            <span className="font-semibold text-navy">{formatMoney(product.pricePaise)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Quick targets">
          {QUICK_DROPS.map((percent) => (
            <button
              key={percent}
              type="button"
              onClick={() => setValue(String(suggest(product.pricePaise, percent) / 100))}
              className={cn(
                'h-10 rounded-full border border-slate-300 px-4 text-sm text-navy hover:bg-navy-50',
                focusRing,
              )}
            >
              {percent}% lower · {formatMoney(suggest(product.pricePaise, percent))}
            </button>
          ))}
        </div>
        <TextField
          label="Alert me when the price drops to (₹)"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error ?? undefined}
          hint="You’ll see it marked in Price alerts as soon as the price gets there."
        />
        {error === null && current?.reached && (
          <Alert tone="success">
            Good news: the price is already at or below your current target.
          </Alert>
        )}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving}>
            {current ? 'Update alert' : 'Set alert'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
