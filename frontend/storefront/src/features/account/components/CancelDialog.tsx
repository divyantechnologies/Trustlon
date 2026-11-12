'use client';
import { useEffect, useId, useState } from 'react';
import { Alert, Button, Dialog, inputClass } from '@/design-system';
import { ApiError } from '@/lib/http';
import { accountApi } from '../api';
import { formatMoney, PAYMENT_LABELS } from '../format';
import type { CancelReason, OrderDetail, PaymentMethod, PaymentStatus, SubOrder } from '../types';

const REASONS: Array<{ value: CancelReason; label: string }> = [
  { value: 'ORDERED_BY_MISTAKE', label: 'Ordered by mistake' },
  { value: 'FOUND_BETTER_PRICE', label: 'Found a better price' },
  { value: 'DELIVERY_TOO_LATE', label: 'Delivery date is too late' },
  { value: 'CHANGED_MIND', label: 'Changed my mind' },
  { value: 'WRONG_ADDRESS', label: 'Wrong delivery address' },
  { value: 'OTHER', label: 'Other reason' },
];

function refundNote(method: PaymentMethod, status: PaymentStatus, amountPaise: number): string {
  const paid = status === 'PAID' || status === 'PARTIALLY_REFUNDED';
  if (!paid) return 'Nothing has been charged for this item, so there is nothing to refund.';
  if (method === 'WALLET')
    return `${formatMoney(amountPaise)} goes back to your Trustlon wallet right away.`;
  return `${formatMoney(amountPaise)} goes back to your ${PAYMENT_LABELS[method].toLowerCase()} within 5 to 7 business days.`;
}

export function CancelDialog({
  order,
  subOrder,
  open,
  onClose,
  onCancelled,
}: {
  order: OrderDetail;
  subOrder: SubOrder;
  open: boolean;
  onClose: () => void;
  onCancelled: (order: OrderDetail) => void;
}) {
  const commentId = useId();
  const [reason, setReason] = useState<CancelReason | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setComment('');
    setError(null);
  }, [open]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reason) {
      setError('Choose a reason to continue.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      onCancelled(await accountApi.cancelSubOrder(subOrder.id, reason, comment));
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'We couldn’t cancel this item. Check your connection and try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const itemNames = subOrder.items.map((item) => item.name).join(', ');

  return (
    <Dialog open={open} title="Cancel item" onClose={onClose}>
      <form onSubmit={submit} className="space-y-5">
        <p className="text-sm text-slate-600">
          You are cancelling <span className="font-semibold text-navy">{itemNames}</span> sold by{' '}
          {subOrder.seller.name}. Other items in this order are not affected.
        </p>
        <fieldset>
          <legend className="mb-2 text-sm font-medium text-navy">Why are you cancelling?</legend>
          <div className="space-y-1">
            {REASONS.map((option) => (
              <label
                key={option.value}
                className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 hover:bg-navy-50"
              >
                <input
                  type="radio"
                  name="cancel-reason"
                  value={option.value}
                  checked={reason === option.value}
                  onChange={() => setReason(option.value)}
                  className="h-4 w-4 accent-teal"
                />
                <span className="text-sm text-navy">{option.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <label htmlFor={commentId} className="mb-1.5 block text-sm font-medium text-navy">
            Anything else? <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id={commentId}
            value={comment}
            maxLength={250}
            rows={3}
            onChange={(e) => setComment(e.target.value)}
            className={`${inputClass(false)} h-auto py-2`}
          />
          <p className="mt-1 text-right text-xs text-slate-500">{comment.length}/250</p>
        </div>
        <Alert tone="info">
          {refundNote(order.payment.method, order.payment.status, subOrder.totals.totalPaise)}
        </Alert>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
            Keep item
          </Button>
          <Button type="submit" variant="destructive" loading={submitting}>
            Cancel item
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
