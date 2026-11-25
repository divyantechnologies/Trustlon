'use client';
import Link from 'next/link';
import { cn, focusRing } from '@/design-system';
import { deliveryNote, formatDate, formatMoney } from '../format';
import type { OrderSummary } from '../types';
import { StatusChip, Thumb } from './ui';

/** One order in a list: number, date, total and the status of each seller's part. */
export function OrderCard({ order, compact = false }: { order: OrderSummary; compact?: boolean }) {
  const extra = order.itemCount - order.previewItems.length;
  return (
    <article className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
        <dl className="flex flex-wrap gap-x-6 gap-y-1">
          <div>
            <dt className="sr-only">Order number</dt>
            <dd className="font-semibold text-navy">#{order.orderNumber}</dd>
          </div>
          <div>
            <dt className="inline">Placed </dt>
            <dd className="inline">{formatDate(order.placedAt)}</dd>
          </div>
          <div>
            <dt className="inline">Total </dt>
            <dd className="inline font-semibold text-navy">{formatMoney(order.totalPaise)}</dd>
          </div>
        </dl>
        <span>
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        </span>
      </header>
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 items-center gap-2" aria-hidden>
          {order.previewItems.slice(0, compact ? 1 : 4).map((item, index) => (
            <Thumb key={`${item.image}-${index}`} src={item.image} alt="" className="h-14 w-14" />
          ))}
          {extra > 0 && !compact && (
            <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-navy-50 text-xs font-semibold text-navy">
              +{extra}
            </span>
          )}
        </div>
        <ul className="min-w-0 flex-1 space-y-2">
          {order.subOrders.map((sub) => (
            <li key={sub.id} className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <StatusChip status={sub.status} />
              <span className="text-sm text-navy">{deliveryNote(sub)}</span>
              {order.subOrders.length > 1 && !compact && (
                <span className="text-xs text-slate-500">from {sub.seller.name}</span>
              )}
            </li>
          ))}
        </ul>
        <Link
          href={`/account/orders/${order.id}`}
          className={cn(
            'inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-navy hover:bg-navy-50',
            focusRing,
          )}
          aria-label={`View order ${order.orderNumber}`}
        >
          View details
        </Link>
      </div>
    </article>
  );
}
