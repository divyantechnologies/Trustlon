'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Card, ErrorState, Loading, PageHeader, Stat } from '@/components/ui';
import { focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { qs } from '@/lib/http';
import { count, money, moneyWhole, shiftDate, todayIst } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { SalesChart, type DayPoint } from './SalesChart';

interface TopItem {
  id: string;
  name: string;
  gmvPaise: number;
  units: number;
}

interface Summary {
  range: { from: string; to: string };
  kpis: {
    gmvTodayPaise: number;
    gmvMonthPaise: number;
    gmvPaise: number;
    orders: number;
    ordersToday: number;
    newCustomers: number;
    activeVendors: number;
    averageOrderValuePaise: number;
  };
  alerts: {
    pendingKyc: number;
    productsAwaitingApproval: number;
    reportedReviews: number;
    openReports: number;
    failedPayouts: number | null;
    openEscalations: number;
  };
  series: DayPoint[];
  top: { products: TopItem[]; vendors: TopItem[]; categories: TopItem[] };
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
];

function TopList({ title, items, unit }: { title: string; items: TopItem[]; unit: string }) {
  const max = Math.max(1, ...items.map((i) => i.gmvPaise));
  return (
    <Card title={title}>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No sales in this period.</p>
      ) : (
        <ol className="space-y-3">
          {items.map((item, index) => (
            <li key={item.id}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="min-w-0 truncate text-navy">
                  <span className="me-1.5 text-slate-400">{index + 1}</span>
                  {item.name}
                </span>
                <span className="shrink-0 tabular-nums text-navy">{moneyWhole(item.gmvPaise)}</span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal"
                    style={{ width: `${(item.gmvPaise / max) * 100}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-end text-[11px] text-slate-500">
                  {count(item.units)} {unit}
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Admin home (5.1): platform health at a glance. */
export function Dashboard() {
  const { profile, can } = useAuth();
  const [days, setDays] = useState(30);
  const to = todayIst();
  const { data, error, loading, reload } = useApi<Summary>(
    `/admin/dashboard/summary${qs({ from: shiftDate(to, -(days - 1)), to })}`,
  );

  const alerts = data
    ? [
        {
          label: 'KYC waiting for review',
          value: data.alerts.pendingKyc,
          href: '/vendors/kyc',
          show: can('vendors:view'),
        },
        {
          label: 'Products awaiting approval',
          value: data.alerts.productsAwaitingApproval,
          href: '/catalog/products',
          show: can('products:view'),
        },
        {
          label: 'Reviews held or reported',
          value: data.alerts.reportedReviews,
          href: '/trust/reviews',
          show: can('trust:view'),
        },
        {
          label: 'Open reports',
          value: data.alerts.openReports,
          href: '/trust/reports',
          show: can('trust:view'),
        },
        {
          label: 'Support tickets open over 48 hours',
          value: data.alerts.openEscalations,
          href: '/orders',
          show: can('orders:view'),
        },
        { label: 'Failed payouts', value: data.alerts.failedPayouts, href: null, show: true },
      ].filter((a) => a.show)
    : [];

  return (
    <div>
      <PageHeader
        title={`Good to see you, ${profile?.user.fullName.split(' ')[0] ?? ''}`}
        description="Platform health at a glance. Amounts include GST and leave out cancelled items."
        actions={
          <div
            role="group"
            aria-label="Period"
            className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5"
          >
            {RANGES.map((r) => (
              <button
                key={r.days}
                type="button"
                aria-pressed={days === r.days}
                onClick={() => setDays(r.days)}
                className={cn(
                  'h-8 rounded-md px-3 text-xs font-semibold',
                  focusRing,
                  days === r.days ? 'bg-navy text-white' : 'text-slate-600 hover:text-navy',
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        }
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={cn('space-y-5 transition-opacity', loading && 'opacity-60')}>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            <Stat
              label="GMV today"
              value={moneyWhole(data.kpis.gmvTodayPaise)}
              hint={`${count(data.kpis.ordersToday)} orders`}
            />
            <Stat label="GMV this month" value={moneyWhole(data.kpis.gmvMonthPaise)} />
            <Stat label={`Orders · ${days} days`} value={count(data.kpis.orders)} />
            <Stat label="Average order value" value={money(data.kpis.averageOrderValuePaise)} />
            <Stat label={`New customers · ${days} days`} value={count(data.kpis.newCustomers)} />
            <Stat
              label="Active vendors"
              value={count(data.kpis.activeVendors)}
              href={can('vendors:view') ? '/vendors?status=ACTIVE' : undefined}
            />
          </div>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card title="Sales" description={`Gross merchandise value per day, ${days} days`}>
              <SalesChart points={data.series} />
            </Card>
            <Card title="Needs attention">
              <ul className="divide-y divide-slate-100">
                {alerts.map((a) => (
                  <li key={a.label}>
                    {a.href ? (
                      <Link
                        href={a.href}
                        className={cn(
                          'flex items-center justify-between gap-3 rounded py-2.5 text-sm hover:text-teal-600',
                          focusRing,
                        )}
                      >
                        <span className="text-navy">{a.label}</span>
                        <span
                          className={cn(
                            'min-w-8 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums',
                            a.value ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-500',
                          )}
                        >
                          {count(a.value)}
                        </span>
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between gap-3 py-2.5 text-sm">
                        <span className="text-navy">{a.label}</span>
                        <span className="text-xs text-slate-500">
                          {a.value === null ? 'With the Finance panel' : count(a.value)}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <TopList title="Top products" items={data.top.products} unit="sold" />
            <TopList title="Top vendors" items={data.top.vendors} unit="orders" />
            <TopList title="Top categories" items={data.top.categories} unit="sold" />
          </div>
        </div>
      )}
    </div>
  );
}
