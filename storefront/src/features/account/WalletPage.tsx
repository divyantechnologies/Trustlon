'use client';
import { useEffect, useState } from 'react';
import { Button, cn, focusRing } from '@/design-system';
import { accountApi } from './api';
import { EmptyState, PageHeader, Panel, Skeleton } from './components/ui';
import { formatDate, formatMoney } from './format';
import type { WalletFilter, WalletOverview, WalletTransaction } from './types';

const FILTERS: Array<{ value: WalletFilter | undefined; label: string }> = [
  { value: undefined, label: 'All' },
  { value: 'refund', label: 'Refunds' },
  { value: 'cashback', label: 'Cashback' },
  { value: 'referral', label: 'Referral' },
  { value: 'spend', label: 'Spent' },
];

const SOURCE_LABELS: Record<WalletTransaction['source'], string> = {
  REFUND: 'Refund',
  CASHBACK: 'Cashback',
  REFERRAL: 'Referral',
  ORDER_PAYMENT: 'Spent',
  ADJUSTMENT: 'Adjustment',
};

function BalanceCards({ wallet }: { wallet: WalletOverview }) {
  const expiring = wallet.coinsExpiringSoon;
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      <div className="rounded-lg bg-navy p-5 text-white">
        <p className="text-xs uppercase tracking-wider text-white/70">Wallet balance</p>
        <p className="mt-2 text-3xl font-semibold">{formatMoney(wallet.balancePaise)}</p>
        <p className="mt-1 text-xs text-white/70">Use it at checkout on any order</p>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xs uppercase tracking-wider text-slate-500">Trustlon Coins</p>
        <p className="mt-2 text-3xl font-semibold text-teal-600">
          {wallet.coins.toLocaleString('en-IN')}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Worth {formatMoney(wallet.coins * wallet.rules.coinValuePaise)}
        </p>
      </div>
      <div
        className={cn(
          'rounded-lg border p-5',
          expiring.coins > 0 ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-white',
        )}
      >
        <p className="text-xs uppercase tracking-wider text-slate-500">
          Expiring in {expiring.withinDays} days
        </p>
        <p
          className={cn(
            'mt-2 text-3xl font-semibold',
            expiring.coins > 0 ? 'text-red-600' : 'text-navy',
          )}
        >
          {expiring.coins.toLocaleString('en-IN')} coins
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {expiring.coins > 0 && expiring.nextExpiry
            ? `First batch expires on ${formatDate(expiring.nextExpiry)}`
            : 'Nothing is expiring soon'}
        </p>
      </div>
    </div>
  );
}

function CoinRules({ wallet }: { wallet: WalletOverview }) {
  const rules = wallet.rules;
  const items = [
    `Earn ${rules.earnPerHundredRupees} coin for every ₹100 you spend, once the order is delivered.`,
    `1 coin = ${formatMoney(rules.coinValuePaise)} at checkout.`,
    `Coins can pay for up to ${rules.maxRedeemPercent}% of an order.`,
    `Coins expire ${rules.expiryMonths} months after you earn them. The oldest coins are used first.`,
    'Wallet money from refunds and cashback never expires.',
  ];
  return (
    <Panel title="How coins work">
      <ul className="space-y-2 text-sm text-slate-600">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            {item}
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** /account/wallet (spec 3.6). */
export function WalletPage() {
  const [wallet, setWallet] = useState<WalletOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<WalletFilter | undefined>(undefined);
  const [items, setItems] = useState<WalletTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    accountApi
      .wallet()
      .then(setWallet)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [filter]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    accountApi
      .walletTransactions(page, filter, controller.signal)
      .then((result) => {
        setItems((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotalPages(result.totalPages);
        setState('ready');
      })
      .catch(() => !controller.signal.aborted && setState('error'));
    return () => controller.abort();
  }, [page, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet and Trustlon Coins"
        description="Refunds, cashback and rewards in one place. Balances update only through the entries below."
      />

      {failed && !wallet ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your wallet"
          description="Refresh the page to try again."
        />
      ) : !wallet ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-busy="true">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      ) : (
        <BalanceCards wallet={wallet} />
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <Panel title="Transactions" className="min-w-0">
          <div
            role="group"
            aria-label="Filter transactions"
            className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1"
          >
            {FILTERS.map((option) => (
              <button
                key={option.label}
                type="button"
                aria-pressed={filter === option.value}
                onClick={() => setFilter(option.value)}
                className={cn(
                  'h-9 shrink-0 rounded-full border px-4 text-sm',
                  focusRing,
                  filter === option.value
                    ? 'border-navy bg-navy text-white'
                    : 'border-slate-300 bg-white text-navy hover:bg-navy-50',
                )}
              >
                {option.label}
              </button>
            ))}
          </div>

          {state === 'error' && items.length === 0 ? (
            <p role="alert" className="py-8 text-center text-slate-500">
              We couldn’t load your transactions.
            </p>
          ) : state === 'loading' && items.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              {[0, 1, 2].map((n) => (
                <Skeleton key={n} className="h-14" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <p className="py-8 text-center text-slate-500">No transactions yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-start text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
                    <tr>
                      <th scope="col" className="py-2 pe-4 font-medium">
                        Date
                      </th>
                      <th scope="col" className="py-2 pe-4 font-medium">
                        Details
                      </th>
                      <th scope="col" className="py-2 pe-4 font-medium">
                        Type
                      </th>
                      <th scope="col" className="py-2 pe-4 text-end font-medium">
                        Amount
                      </th>
                      <th scope="col" className="py-2 text-end font-medium">
                        Balance
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => {
                      const credit = item.type === 'CREDIT';
                      return (
                        <tr key={item.id} className="align-top">
                          <td className="whitespace-nowrap py-3 pe-4 text-slate-500">
                            {formatDate(item.createdAt)}
                          </td>
                          <td className="py-3 pe-4 text-navy">
                            {item.description}
                            {item.reference && (
                              <span className="block text-xs text-slate-500">
                                Ref {item.reference}
                              </span>
                            )}
                            {item.coins > 0 && item.coinsExpireAt && (
                              <span className="block text-xs text-slate-500">
                                Coins expire {formatDate(item.coinsExpireAt)}
                              </span>
                            )}
                          </td>
                          <td className="py-3 pe-4">
                            <span className="rounded-full bg-navy-50 px-2.5 py-0.5 text-xs text-navy">
                              {SOURCE_LABELS[item.source]}
                            </span>
                          </td>
                          <td
                            className={cn(
                              'whitespace-nowrap py-3 pe-4 text-end font-semibold',
                              credit ? 'text-teal-600' : 'text-navy',
                            )}
                          >
                            {item.amountPaise > 0 &&
                              `${credit ? '+' : '−'} ${formatMoney(item.amountPaise)}`}
                            {item.coins > 0 && (
                              <span className="block text-xs font-medium">
                                {credit ? '+' : '−'} {item.coins} coins
                              </span>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-3 text-end text-slate-500">
                            {formatMoney(item.balanceAfterPaise)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {page < totalPages && (
                <div className="mx-auto mt-4 w-48">
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
        </Panel>
        <div>{wallet && <CoinRules wallet={wallet} />}</div>
      </div>
    </div>
  );
}
