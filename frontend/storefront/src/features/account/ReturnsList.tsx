'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, cn, focusRing } from '@/design-system';
import { Icon, type IconName } from '@/features/home/components/Icon';
import { accountApi } from './api';
import {
  EmptyState,
  PageHeader,
  primaryLink,
  ReturnStatusChip,
  Skeleton,
  Thumb,
} from './components/ui';
import { formatDate, formatMoney } from './format';
import type { ReturnSummary } from './types';

const PAGE_SIZE = 10;

const STEPS: Array<{ icon: IconName; title: string; text: string }> = [
  { icon: 'bag', title: 'Choose items', text: 'Open a delivered order and select Return items.' },
  { icon: 'truck', title: 'Free pickup', text: 'A courier collects the items from your address.' },
  {
    icon: 'return',
    title: 'Get your refund',
    text: 'Refunds start once the seller checks the items.',
  },
];

function ReturnCard({ item }: { item: ReturnSummary }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3 text-xs text-slate-500">
        <span>
          <span className="font-semibold text-navy">Return #{item.returnNumber}</span> · Requested{' '}
          {formatDate(item.requestedAt)}
        </span>
        <span>
          Order{' '}
          <Link
            href={`/account/orders/${item.order.id}`}
            className="font-medium text-teal-600 hover:underline"
          >
            #{item.order.orderNumber}
          </Link>
        </span>
      </header>
      <div className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center">
        <div className="flex shrink-0 gap-2" aria-hidden>
          {item.items.slice(0, 3).map((line, index) => (
            <Thumb key={`${line.image}-${index}`} src={line.image} alt="" className="h-14 w-14" />
          ))}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReturnStatusChip status={item.status} />
            <span className="text-sm text-navy">{item.reasonLabel}</span>
          </div>
          <p className="truncate text-sm text-slate-500">
            {item.items
              .map((line) => `${line.name}${line.quantity > 1 ? ` × ${line.quantity}` : ''}`)
              .join(', ')}{' '}
            · from {item.seller.name}
          </p>
          <p className="text-sm text-navy">
            Refund <span className="font-semibold">{formatMoney(item.refundAmountPaise)}</span>
          </p>
        </div>
        <Link
          href={`/account/returns/${item.id}`}
          className={cn(
            'inline-flex h-11 shrink-0 items-center justify-center rounded-lg border border-slate-300 px-4 text-sm font-semibold text-navy hover:bg-navy-50',
            focusRing,
          )}
          aria-label={`View return ${item.returnNumber}`}
        >
          View details
        </Link>
      </div>
    </article>
  );
}

/** /account/returns (spec 3.3): every return and its refund status. */
export function ReturnsList() {
  const [items, setItems] = useState<ReturnSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    accountApi
      .returns(page, PAGE_SIZE, controller.signal)
      .then((result) => {
        setItems((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotalPages(result.totalPages);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [page, attempt]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Returns and refunds"
        description="Track pickups and refunds for items you sent back."
      />

      <ol className="grid gap-3 sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li
            key={step.title}
            className="flex gap-3 rounded-lg border border-slate-200 bg-white p-4"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
              <Icon name={step.icon} className="h-4 w-4" />
            </span>
            <span>
              <span className="block text-sm font-semibold text-navy">
                {index + 1}. {step.title}
              </span>
              <span className="mt-0.5 block text-xs text-slate-500">{step.text}</span>
            </span>
          </li>
        ))}
      </ol>

      {state === 'error' && items.length === 0 ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your returns"
          action={
            <div className="w-40">
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          }
        />
      ) : state === 'loading' && items.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No returns yet"
          description="Delivered items can be returned within the return window shown on the order."
          action={
            <Link href="/account/orders?status=delivered" className={primaryLink}>
              See delivered orders
            </Link>
          }
        />
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <ReturnCard key={item.id} item={item} />
            ))}
          </div>
          {page < totalPages && (
            <div className="mx-auto w-48">
              <Button
                variant="secondary"
                loading={state === 'loading'}
                onClick={() => setPage((p) => p + 1)}
              >
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
