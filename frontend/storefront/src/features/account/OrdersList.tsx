'use client';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Button, cn, focusRing, inputClass, typography } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { accountApi } from './api';
import { OrderCard } from './components/OrderCard';
import { Skeleton } from './components/ui';
import type { OrderQuery, OrderStatusFilter, OrderSummary } from './types';

const PAGE_SIZE = 10;

const STATUS_TABS: Array<{ value: OrderStatusFilter | undefined; label: string }> = [
  { value: undefined, label: 'All orders' },
  { value: 'active', label: 'In progress' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'returns', label: 'Returns' },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function readFilters(params: URLSearchParams): OrderQuery {
  const status = params.get('status');
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  return {
    status: STATUS_TABS.some((tab) => tab.value === status)
      ? (status as OrderStatusFilter)
      : undefined,
    q: params.get('q')?.trim().slice(0, 100) || undefined,
    from: DATE.test(from) ? from : undefined,
    to: DATE.test(to) ? to : undefined,
  };
}

/** Status tabs, product search and date range. Kept in the URL so the view can be shared or refreshed. */
function OrderFilters({
  filters,
  onChange,
}: {
  filters: OrderQuery;
  onChange: (next: OrderQuery) => void;
}) {
  const searchId = useId();
  const fromId = useId();
  const toId = useId();
  const [query, setQuery] = useState(filters.q ?? '');

  useEffect(() => setQuery(filters.q ?? ''), [filters.q]);

  useEffect(() => {
    const value = query.trim();
    if (value === (filters.q ?? '')) return;
    const timer = window.setTimeout(() => onChange({ ...filters, q: value || undefined }), 350);
    return () => window.clearTimeout(timer);
  }, [query, filters, onChange]);

  const hasExtra = Boolean(filters.q || filters.from || filters.to);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);

  return (
    <div className="space-y-4">
      <div
        role="group"
        aria-label="Order status"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0"
      >
        {STATUS_TABS.map((tab) => {
          const selected = filters.status === tab.value;
          return (
            <button
              key={tab.label}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange({ ...filters, status: tab.value })}
              className={cn(
                'h-10 shrink-0 rounded-full border px-4 text-sm font-medium',
                focusRing,
                selected
                  ? 'border-navy bg-navy text-white'
                  : 'border-slate-300 bg-white text-navy hover:bg-navy-50',
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,1fr)_170px_170px_auto] md:items-end">
        <div>
          <label htmlFor={searchId} className="mb-1.5 block text-sm font-medium text-navy">
            Search by product
          </label>
          <div className="relative">
            <Icon
              name="search"
              className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400"
            />
            <input
              id={searchId}
              type="search"
              value={query}
              maxLength={100}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. headphones"
              className={cn(inputClass(false), 'pl-10')}
            />
          </div>
        </div>
        <div>
          <label htmlFor={fromId} className="mb-1.5 block text-sm font-medium text-navy">
            From
          </label>
          <input
            id={fromId}
            type="date"
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(e) => onChange({ ...filters, from: e.target.value || undefined })}
            className={inputClass(invalidRange)}
          />
        </div>
        <div>
          <label htmlFor={toId} className="mb-1.5 block text-sm font-medium text-navy">
            To
          </label>
          <input
            id={toId}
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(e) => onChange({ ...filters, to: e.target.value || undefined })}
            className={inputClass(invalidRange)}
          />
        </div>
        {hasExtra && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              onChange({ status: filters.status });
            }}
            className={cn(
              'h-11 rounded-lg px-3 text-sm font-semibold text-teal-600 hover:underline',
              focusRing,
            )}
          >
            Clear
          </button>
        )}
      </div>
      {invalidRange && (
        <p role="alert" className="text-sm text-red-600">
          The start date must be on or before the end date.
        </p>
      )}
    </div>
  );
}

/** /account/orders: every order, newest first, with filters and "Show more". */
export function OrdersList() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const search = params.toString();
  const filters = useMemo(() => readFilters(new URLSearchParams(search)), [search]);
  const key = JSON.stringify(filters);

  const [items, setItems] = useState<OrderSummary[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);

  const updateFilters = useCallback(
    (next: OrderQuery) => {
      const nextSearch = new URLSearchParams();
      for (const [name, value] of Object.entries(next))
        if (value) nextSearch.set(name, String(value));
      const text = nextSearch.toString();
      router.replace(text ? `${pathname}?${text}` : pathname, { scroll: false });
    },
    [router, pathname],
  );

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [key]);

  useEffect(() => {
    const current: OrderQuery = JSON.parse(key);
    if (current.from && current.to && current.from > current.to) {
      setItems([]);
      setTotal(0);
      setState('ready');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    accountApi
      .orders({ ...current, page, pageSize: PAGE_SIZE }, controller.signal)
      .then((result) => {
        setItems((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotal(result.total);
        setTotalPages(result.totalPages);
        setState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setState('error');
      });
    return () => controller.abort();
  }, [key, page, attempt]);

  const filtered = Boolean(filters.status || filters.q || filters.from || filters.to);

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>Your orders</h1>
        <p className="mt-1 text-slate-500">Track, cancel or download invoices for your orders.</p>
      </div>

      <OrderFilters filters={filters} onChange={updateFilters} />

      <p className="text-sm text-slate-500" aria-live="polite">
        {state === 'loading' && items.length === 0
          ? 'Loading orders…'
          : state === 'ready'
            ? `${total} ${total === 1 ? 'order' : 'orders'}`
            : ''}
      </p>

      {state === 'error' && items.length === 0 ? (
        <div role="alert" className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-500">We couldn’t load your orders.</p>
          <div className="mx-auto mt-4 w-40">
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      ) : state === 'loading' && items.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          {[0, 1, 2].map((n) => (
            <Skeleton key={n} className="h-36" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-10 text-center">
          <p className="font-semibold text-navy">
            {filtered ? 'No orders match these filters' : 'No orders yet'}
          </p>
          <p className="mt-1 text-slate-500">
            {filtered
              ? 'Try another status, product or date range.'
              : 'When you place an order, it will show up here.'}
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={() => updateFilters({})}
              className={cn(
                'mt-4 h-11 rounded-lg px-4 text-sm font-semibold text-teal-600 hover:underline',
                focusRing,
              )}
            >
              Show all orders
            </button>
          ) : (
            <Link
              href="/"
              className="mt-4 inline-flex h-11 items-center rounded-lg bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700"
            >
              Start shopping
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((order) => (
              <OrderCard key={order.id} order={order} />
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
          {state === 'error' && items.length > 0 && (
            <p role="alert" className="text-center text-sm text-red-600">
              We couldn’t load more orders.{' '}
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className={cn('font-semibold text-teal-600 hover:underline', focusRing)}
              >
                Try again
              </button>
            </p>
          )}
        </>
      )}
    </div>
  );
}
