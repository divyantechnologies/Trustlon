'use client';
import { useEffect, useId, useState } from 'react';
import { Alert, Button, cn, focusRing, inputClass } from '@/design-system';
import { homeApi } from '@/features/home/api';
import { Icon } from '@/features/home/components/Icon';
import type { Suggestions } from '@/features/home/types';
import { ApiError } from '@/lib/http';
import { accountApi } from './api';
import { EmptyState, PageHeader, Panel, secondaryAction, Skeleton, Thumb } from './components/ui';
import { formatDate, formatMoney } from './format';
import type { AffiliateEarning, AffiliateLink, AffiliateSummary } from './types';

const EARNING_STATUS: Record<AffiliateEarning['status'], { label: string; tone: string }> = {
  PENDING: { label: 'Pending', tone: 'bg-navy-50 text-navy' },
  CONFIRMED: { label: 'Confirmed', tone: 'bg-teal-50 text-teal-600' },
  PAID: { label: 'Paid', tone: 'bg-teal-50 text-teal-600' },
  CANCELLED: { label: 'Cancelled', tone: 'bg-slate-100 text-slate-600' },
};

function useOrigin(): string {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return origin;
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={secondaryAction}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
        }
      }}
    >
      <Icon name={copied ? 'check' : 'plus'} className="h-4 w-4" />
      <span aria-live="polite">{copied ? 'Copied' : label}</span>
    </button>
  );
}

function ReferralCard({ summary, origin }: { summary: AffiliateSummary; origin: string }) {
  const link = `${origin}${summary.referral.path}`;
  const message = `Join me on Trustlon for escrow-protected shopping from verified sellers: ${link}`;
  return (
    <Panel title="Invite friends">
      <p className="text-sm text-slate-600">
        Share your code. Friends enter it when they sign up
        {summary.rules.referralRewardPaise > 0 ? ', and you get ' : '.'}
        {summary.rules.referralRewardPaise > 0 && (
          <>
            <span className="font-semibold text-navy">
              {formatMoney(summary.rules.referralRewardPaise)}
            </span>{' '}
            in your wallet when their first order is delivered.
          </>
        )}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="rounded-lg border-2 border-dashed border-teal bg-teal-50 px-4 py-2 font-mono text-lg font-semibold tracking-widest text-teal-600">
          {summary.referral.code}
        </span>
        <CopyButton text={summary.referral.code} label="Copy code" />
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={link}
          aria-label="Referral link"
          className={cn(inputClass(false), 'flex-1 bg-slate-50')}
        />
        <CopyButton text={link} label="Copy link" />
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noreferrer"
          className={cn(secondaryAction, 'border-teal text-teal-600')}
        >
          Share on WhatsApp
        </a>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4 text-sm">
        <div>
          <dt className="text-slate-500">Friends joined</dt>
          <dd className="text-xl font-semibold text-navy">{summary.referral.friendsJoined}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Referral rewards</dt>
          <dd className="text-xl font-semibold text-navy">
            {formatMoney(summary.referral.rewardsPaise)}
          </dd>
        </div>
      </dl>
    </Panel>
  );
}

function LinkGenerator({ onCreated }: { onCreated: (links: AffiliateLink[]) => void }) {
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Suggestions['products']>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      homeApi
        .suggest(q, controller.signal)
        .then((data) => setResults(data.products))
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return (
    <Panel title="Create a product link">
      <p className="text-sm text-slate-600">
        Find a product, create its link and share it anywhere.
      </p>
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <div className="relative mt-4">
        <Icon
          name="search"
          className="pointer-events-none absolute start-3 top-3 h-5 w-5 text-slate-400"
        />
        <input
          id={inputId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for a product"
          className={cn(inputClass(false), 'ps-10')}
        />
      </div>
      {error && (
        <div className="mt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {results.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-200">
          {results.map((product) => (
            <li key={product.id} className="flex items-center gap-3 p-3">
              <Thumb src={product.image} alt="" className="h-12 w-12" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-navy">{product.name}</p>
              </div>
              <button
                type="button"
                className={secondaryAction}
                disabled={busy === product.id}
                onClick={async () => {
                  setBusy(product.id);
                  setError(null);
                  try {
                    onCreated((await accountApi.createAffiliateLink(product.id)).items);
                    setQuery('');
                    setResults([]);
                  } catch (caught) {
                    setError(
                      caught instanceof ApiError && caught.message
                        ? caught.message
                        : 'We couldn’t create the link.',
                    );
                  } finally {
                    setBusy(null);
                  }
                }}
              >
                {busy === product.id ? 'Creating…' : 'Get link'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/** /account/affiliate (spec 3.9). */
export function AffiliatePage() {
  const origin = useOrigin();
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [links, setLinks] = useState<AffiliateLink[]>([]);
  const [earnings, setEarnings] = useState<AffiliateEarning[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    Promise.all([accountApi.affiliateSummary(), accountApi.affiliateLinks()])
      .then(([s, l]) => {
        setSummary(s);
        setLinks(l.items);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    accountApi
      .affiliateEarnings(page, controller.signal)
      .then((result) => {
        setEarnings((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotalPages(result.totalPages);
      })
      .catch(() => undefined);
    return () => controller.abort();
  }, [page]);

  if (failed)
    return (
      <EmptyState
        role="alert"
        title="We couldn’t load your referrals"
        description="Refresh the page to try again."
      />
    );
  if (!summary) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    );
  }

  const stats = [
    { label: 'Link clicks', value: summary.affiliate.clicks.toLocaleString('en-IN') },
    { label: 'Orders', value: summary.affiliate.orders.toLocaleString('en-IN') },
    { label: 'Pending', value: formatMoney(summary.affiliate.pendingPaise) },
    { label: 'Confirmed', value: formatMoney(summary.affiliate.confirmedPaise) },
    { label: 'Paid', value: formatMoney(summary.affiliate.paidPaise) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Refer and earn"
        description={`Invite friends, and earn ${summary.rules.commissionPercent}% on orders placed through your product links.`}
      />

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <dt className="text-xs text-slate-500">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold text-navy">{stat.value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <ReferralCard summary={summary} origin={origin} />
        <LinkGenerator onCreated={setLinks} />
      </div>

      <Panel title="Your product links">
        {links.length === 0 ? (
          <p className="text-sm text-slate-500">
            Links you create will show here with their clicks.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {links.map((link) => (
              <li
                key={link.id}
                className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
              >
                {link.product ? (
                  <Thumb src={link.product.image} alt="" className="h-12 w-12" />
                ) : (
                  <span className="h-12 w-12 rounded-lg bg-slate-100" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-navy">
                    {link.product?.name ?? 'Product no longer sold'}
                  </p>
                  <p className="truncate font-mono text-xs text-slate-500">{`${origin}${link.path}`}</p>
                </div>
                <span className="text-sm text-slate-500">{link.clicks} clicks</span>
                {link.product && <CopyButton text={`${origin}${link.path}`} label="Copy link" />}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Earnings">
        {earnings.length === 0 ? (
          <p className="text-sm text-slate-500">
            When someone buys through your links, the order shows here.
          </p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-start text-sm">
                <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th scope="col" className="py-2 pe-4 font-medium">
                      Order
                    </th>
                    <th scope="col" className="py-2 pe-4 font-medium">
                      Product
                    </th>
                    <th scope="col" className="py-2 pe-4 text-end font-medium">
                      Sale
                    </th>
                    <th scope="col" className="py-2 pe-4 text-end font-medium">
                      Commission
                    </th>
                    <th scope="col" className="py-2 font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {earnings.map((earning) => (
                    <tr key={earning.id} className="align-top">
                      <td className="py-3 pe-4">
                        <span className="font-medium text-navy">#{earning.orderNumber}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDate(earning.createdAt)}
                        </span>
                      </td>
                      <td className="py-3 pe-4 text-navy">{earning.productName}</td>
                      <td className="py-3 pe-4 text-end text-slate-600">
                        {formatMoney(earning.saleAmountPaise)}
                      </td>
                      <td className="py-3 pe-4 text-end font-semibold text-navy">
                        {formatMoney(earning.commissionPaise)}
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            EARNING_STATUS[earning.status].tone,
                          )}
                        >
                          {EARNING_STATUS[earning.status].label}
                        </span>
                        {earning.status === 'PENDING' && (
                          <span className="block pt-1 text-xs text-slate-500">
                            Confirms after {formatDate(earning.confirmAfter)}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {page < totalPages && (
              <div className="mx-auto mt-4 w-48">
                <Button variant="secondary" onClick={() => setPage((p) => p + 1)}>
                  Show more
                </Button>
              </div>
            )}
          </>
        )}
        <p className="mt-4 text-xs text-slate-500">
          A commission is confirmed once the item’s return window closes, so returned orders do not
          count. Clicks are remembered for {summary.rules.attributionDays} days.
        </p>
      </Panel>
    </div>
  );
}
