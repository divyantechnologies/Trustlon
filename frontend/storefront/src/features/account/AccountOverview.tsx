'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, cn, focusRing, typography } from '@/design-system';
import { Icon, type IconName } from '@/features/home/components/Icon';
import { formatInternational } from '@/lib/phone';
import { accountApi } from './api';
import { OrderCard } from './components/OrderCard';
import { Panel, Skeleton } from './components/ui';
import { formatDate, formatMoney, initials } from './format';
import type { AccountSummary } from './types';

function Verified({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex items-center gap-1 text-xs text-teal-600">
      <Icon name="check" className="h-3.5 w-3.5" />
      Verified
    </span>
  ) : (
    <span className="text-xs text-slate-500">Not verified</span>
  );
}

function ProfileSummary({ summary }: { summary: AccountSummary }) {
  const { profile, prime } = summary;
  return (
    <Panel>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span
          aria-hidden
          className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-navy text-xl font-semibold text-white"
        >
          {initials(profile.fullName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold text-navy">{profile.fullName}</p>
            {prime.active ? (
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
                Prime{prime.endsAt ? ` · till ${formatDate(prime.endsAt)}` : ''}
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
                Not a Prime member
              </span>
            )}
          </div>
          <dl className="mt-2 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
            <div className="flex flex-wrap items-center gap-2">
              <dt className="sr-only">Mobile</dt>
              <dd className="text-navy">{formatInternational(profile.mobile)}</dd>
              <Verified ok={profile.mobileVerified} />
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <dt className="sr-only">Email</dt>
              <dd className="truncate text-navy">{profile.email}</dd>
              <Verified ok={profile.emailVerified} />
            </div>
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            Member since {formatDate(profile.memberSince)}
          </p>
        </div>
      </div>
    </Panel>
  );
}

function WalletWidget({ summary }: { summary: AccountSummary }) {
  return (
    <Panel title="Wallet and Trustlon Coins">
      <dl className="grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-navy-50 p-4">
          <dt className="text-xs text-slate-500">Wallet balance</dt>
          <dd className="mt-1 text-xl font-semibold text-navy">
            {formatMoney(summary.wallet.balancePaise)}
          </dd>
        </div>
        <div className="rounded-lg bg-teal-50 p-4">
          <dt className="text-xs text-slate-500">Trustlon Coins</dt>
          <dd className="mt-1 text-xl font-semibold text-teal-600">
            {summary.wallet.coins.toLocaleString('en-IN')}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-slate-500">
        Refunds for wallet payments and cashback land here.
      </p>
    </Panel>
  );
}

function Stats({ summary }: { summary: AccountSummary }) {
  const stats = [
    { label: 'Orders', value: summary.counts.orders },
    { label: 'In progress', value: summary.counts.activeOrders },
    { label: 'Wishlist', value: summary.counts.wishlist },
  ];
  return (
    <dl className="grid grid-cols-3 gap-3">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4">
          <dt className="text-xs text-slate-500">{stat.label}</dt>
          <dd className="mt-1 text-xl font-semibold text-navy">{stat.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const QUICK_LINKS: Array<{ label: string; description: string; href: string; icon: IconName }> = [
  {
    label: 'Track an order',
    description: 'See where your items are',
    href: '/account/orders?status=active',
    icon: 'truck',
  },
  {
    label: 'Start a return',
    description: 'Delivered items within the return window',
    href: '/account/orders?status=delivered',
    icon: 'return',
  },
  {
    label: 'Contact support',
    description: 'We usually reply within a day',
    href: '/browse/help',
    icon: 'shield',
  },
];

function QuickLinks() {
  return (
    <Panel title="Quick links">
      <ul className="grid gap-3 sm:grid-cols-3">
        {QUICK_LINKS.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className={cn(
                'flex h-full items-start gap-3 rounded-lg border border-slate-200 p-4 hover:border-teal hover:bg-teal-50/40',
                focusRing,
              )}
            >
              <Icon name={link.icon} className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
              <span>
                <span className="block text-sm font-semibold text-navy">{link.label}</span>
                <span className="mt-0.5 block text-xs text-slate-500">{link.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function RecentOrders({ summary }: { summary: AccountSummary }) {
  return (
    <Panel
      title="Recent orders"
      action={
        summary.counts.orders > 0 && (
          <Link
            href="/account/orders"
            className="text-sm font-semibold text-teal-600 hover:underline"
          >
            View all orders
          </Link>
        )
      }
    >
      {summary.recentOrders.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-slate-500">You haven’t placed an order yet.</p>
          <Link
            href="/"
            className="mt-4 inline-flex h-11 items-center rounded-lg bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700"
          >
            Start shopping
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {summary.recentOrders.map((order) => (
            <OrderCard key={order.id} order={order} compact />
          ))}
        </div>
      )}
    </Panel>
  );
}

/** /account: profile, recent orders, wallet and quick links. */
export function AccountOverview() {
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    accountApi
      .summary(controller.signal)
      .then(setSummary)
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [attempt]);

  const firstName = summary?.profile.fullName.split(' ')[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className={typography.pageTitle}>{firstName ? `Hi, ${firstName}` : 'My account'}</h1>
        <p className="mt-1 text-slate-500">Your orders, money and preferences in one place.</p>
      </div>

      {failed && !summary ? (
        <div role="alert" className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-500">
            We couldn’t load your account. Check your connection and try again.
          </p>
          <div className="mx-auto mt-4 w-40">
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      ) : !summary ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-32" />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <Skeleton className="h-80" />
            <Skeleton className="h-48" />
          </div>
        </div>
      ) : (
        <>
          <ProfileSummary summary={summary} />
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <RecentOrders summary={summary} />
            </div>
            <div className="space-y-6">
              <WalletWidget summary={summary} />
              <Stats summary={summary} />
            </div>
          </div>
          <QuickLinks />
        </>
      )}
    </div>
  );
}
