'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  DataTable,
  ErrorState,
  KeyValues,
  LinkBtn,
  Loading,
  NumberInput,
  PageHeader,
  ReasonDialog,
  Stat,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import { ListSelect } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { count, date, dateTime, humanize, money, moneyWhole } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface CustomerDetail {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  status: string;
  blockedReason: string | null;
  codDisabled: boolean;
  preferredLanguage: string;
  joinedAt: string;
  lastLoginAt: string | null;
  mobileVerified: boolean;
  emailVerified: boolean;
  counts: {
    orders: number;
    addresses: number;
    reviews: number;
    supportTickets: number;
    returnRequests: number;
  };
  lifetimeValuePaise: number;
  prime: { plan: string; endsAt: string } | null;
  b2b: {
    businessName: string;
    gstin: string;
    pan: string;
    billingLine1: string;
    billingLine2: string | null;
    billingCity: string;
    billingState: string;
    billingPincode: string;
    status: string;
    rejectionReason: string | null;
    submittedAt: string;
    verifiedAt: string | null;
  } | null;
  wallet: {
    balancePaise: number;
    coins: number;
    entries: Array<{
      id: string;
      type: string;
      source: string;
      amountPaise: number;
      coins: number;
      description: string;
      at: string;
    }>;
  };
  orders: Array<{
    id: string;
    orderNumber: string;
    placedAt: string;
    totalPaise: number;
    paymentMethod: string;
    paymentStatus: string;
    statuses: string[];
  }>;
  returns: Array<{
    id: string;
    returnNumber: string;
    status: string;
    reason: string;
    refundAmountPaise: number;
    requestedAt: string;
  }>;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    status: string;
    category: string;
    createdAt: string;
  }>;
  risk: {
    score: number;
    level: 'low' | 'medium' | 'high';
    signals: Array<{ label: string; points: number }>;
  };
}

type TabKey = 'orders' | 'returns' | 'wallet' | 'tickets';
type Dialog = null | 'block' | 'unblock' | 'cod' | 'b2b-verify' | 'b2b-reject' | 'wallet';

/** Customer detail (5.6 CustomerDetail + CustomerActions). */
export function CustomerDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const { data: c, error, reload, setData } = useApi<CustomerDetail>(`/admin/customers/${id}`);
  const [tab, setTab] = useState<TabKey>('orders');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [direction, setDirection] = useState<'CREDIT' | 'DEBIT'>('CREDIT');
  const [amount, setAmount] = useState<number | null>(null);
  const [coins, setCoins] = useState<number | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!c) return <Loading />;

  const post = (path: string, method: 'POST' | 'PATCH', body: object) => async (reason: string) => {
    setData(
      await apiFetch<CustomerDetail>(`/admin/customers/${c.id}${path}`, {
        method,
        body: { ...body, reason },
      }),
    );
  };
  const canEdit = can('customers:edit');
  const riskTone =
    c.risk.level === 'high' ? 'danger' : c.risk.level === 'medium' ? 'warning' : 'success';

  return (
    <div>
      <PageHeader
        back={{ href: '/customers', label: 'Customers' }}
        title={c.fullName}
        meta={
          <>
            <StatusBadge value={c.status} />
            {c.codDisabled && <Badge tone="warning">COD disabled</Badge>}
            {c.prime && <Badge tone="navy">Prime · {humanize(c.prime.plan)}</Badge>}
            {c.b2b && (
              <StatusBadge value={c.b2b.status} label={`B2B · ${humanize(c.b2b.status)}`} />
            )}
            <Badge tone={riskTone}>
              Risk {c.risk.score} · {c.risk.level}
            </Badge>
          </>
        }
        actions={
          canEdit && (
            <>
              {c.status === 'ACTIVE' ? (
                <Btn size="sm" tone="danger" onClick={() => setDialog('block')}>
                  Block
                </Btn>
              ) : (
                <Btn size="sm" onClick={() => setDialog('unblock')}>
                  Unblock
                </Btn>
              )}
              <Btn size="sm" onClick={() => setDialog('cod')}>
                {c.codDisabled ? 'Allow COD' : 'Disable COD'}
              </Btn>
              {can('customers:approve') && (
                <Btn
                  size="sm"
                  onClick={() => {
                    setDirection('CREDIT');
                    setAmount(null);
                    setCoins(null);
                    setDialog('wallet');
                  }}
                >
                  Adjust wallet
                </Btn>
              )}
            </>
          )
        }
      />

      {c.status === 'BLOCKED' && c.blockedReason && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          Blocked: {c.blockedReason}
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Orders" value={count(c.counts.orders)} />
        <Stat label="Lifetime value" value={moneyWhole(c.lifetimeValuePaise)} />
        <Stat
          label="Wallet"
          value={money(c.wallet.balancePaise)}
          hint={`${count(c.wallet.coins)} coins`}
        />
        <Stat
          label="Returns"
          value={count(c.counts.returnRequests)}
          hint={`${count(c.counts.supportTickets)} tickets`}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Tabs
            label="Customer records"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'orders', label: 'Orders', count: c.counts.orders },
              { key: 'returns', label: 'Returns', count: c.returns.length },
              { key: 'wallet', label: 'Wallet and coins' },
              { key: 'tickets', label: 'Tickets', count: c.tickets.length },
            ]}
          />
          {tab === 'orders' && (
            <>
              <DataTable
                caption="Recent orders"
                rows={c.orders}
                rowKey={(o) => o.id}
                rowHref={(o) => `/orders/${o.id}`}
                columns={[
                  {
                    key: 'n',
                    header: 'Order',
                    primary: true,
                    cell: (o) => <span className="font-mono">{o.orderNumber}</span>,
                  },
                  { key: 'd', header: 'Placed', cell: (o) => date(o.placedAt) },
                  {
                    key: 's',
                    header: 'Status',
                    cell: (o) => (
                      <span className="flex flex-wrap gap-1">
                        {o.statuses.map((s) => (
                          <StatusBadge key={s} value={s} />
                        ))}
                      </span>
                    ),
                  },
                  {
                    key: 'p',
                    header: 'Payment',
                    cell: (o) =>
                      `${o.paymentMethod === 'COD' ? 'COD' : humanize(o.paymentMethod)} · ${humanize(o.paymentStatus)}`,
                  },
                  {
                    key: 't',
                    header: 'Total',
                    align: 'end',
                    cell: (o) => <span className="tabular-nums">{money(o.totalPaise)}</span>,
                  },
                ]}
              />
              {c.counts.orders > c.orders.length && (
                <div className="mt-3">
                  <LinkBtn size="sm" href={`/orders?customerId=${c.id}`}>
                    See all {c.counts.orders} orders
                  </LinkBtn>
                </div>
              )}
            </>
          )}
          {tab === 'returns' && (
            <DataTable
              caption="Returns"
              rows={c.returns}
              rowKey={(r) => r.id}
              columns={[
                {
                  key: 'n',
                  header: 'Return',
                  primary: true,
                  cell: (r) => <span className="font-mono">{r.returnNumber}</span>,
                },
                { key: 'd', header: 'Requested', cell: (r) => date(r.requestedAt) },
                { key: 'r', header: 'Reason', cell: (r) => humanize(r.reason) },
                { key: 's', header: 'Status', cell: (r) => <StatusBadge value={r.status} /> },
                {
                  key: 'a',
                  header: 'Refund',
                  align: 'end',
                  cell: (r) => money(r.refundAmountPaise),
                },
              ]}
            />
          )}
          {tab === 'wallet' && (
            <DataTable
              caption="Wallet entries"
              rows={c.wallet.entries}
              rowKey={(e) => e.id}
              columns={[
                { key: 'd', header: 'Description', primary: true, cell: (e) => e.description },
                { key: 'w', header: 'When', cell: (e) => dateTime(e.at) },
                { key: 's', header: 'Source', cell: (e) => humanize(e.source) },
                {
                  key: 'a',
                  header: 'Amount',
                  align: 'end',
                  cell: (e) => (
                    <span
                      className={cn(
                        'tabular-nums',
                        e.type === 'CREDIT' ? 'text-teal-600' : 'text-navy',
                      )}
                    >
                      {e.type === 'CREDIT' ? '+' : '−'}
                      {e.amountPaise
                        ? money(Math.abs(e.amountPaise))
                        : `${Math.abs(e.coins)} coins`}
                    </span>
                  ),
                },
              ]}
            />
          )}
          {tab === 'tickets' && (
            <DataTable
              caption="Support tickets"
              rows={c.tickets}
              rowKey={(t) => t.id}
              columns={[
                {
                  key: 'n',
                  header: 'Ticket',
                  primary: true,
                  cell: (t) => `${t.ticketNumber} · ${t.subject}`,
                },
                { key: 'c', header: 'Category', cell: (t) => humanize(t.category) },
                { key: 's', header: 'Status', cell: (t) => <StatusBadge value={t.status} /> },
                { key: 'd', header: 'Opened', cell: (t) => date(t.createdAt) },
              ]}
            />
          )}
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Profile">
            <KeyValues
              columns={1}
              items={[
                ['Mobile', `${c.mobile}${c.mobileVerified ? ' · verified' : ''}`],
                ['Email', `${c.email}${c.emailVerified ? ' · verified' : ''}`],
                ['Language', c.preferredLanguage],
                ['Joined', date(c.joinedAt)],
                ['Last sign-in', dateTime(c.lastLoginAt)],
                ['Saved addresses', String(c.counts.addresses)],
                ['Reviews written', String(c.counts.reviews)],
                ...(c.prime
                  ? ([['Prime until', date(c.prime.endsAt)]] as Array<[string, string]>)
                  : []),
              ]}
            />
          </Card>

          <Card title="Risk score" description="Worked out from orders, returns and reviews.">
            <div
              className="mb-3 h-2 overflow-hidden rounded-full bg-slate-100"
              role="meter"
              aria-valuenow={c.risk.score}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Risk score"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  c.risk.level === 'high'
                    ? 'bg-red-600'
                    : c.risk.level === 'medium'
                      ? 'bg-amber-500'
                      : 'bg-teal',
                )}
                style={{ width: `${Math.max(4, c.risk.score)}%` }}
              />
            </div>
            {c.risk.signals.length === 0 ? (
              <p className="text-sm text-slate-500">No warning signs.</p>
            ) : (
              <ul className="space-y-1 text-sm text-navy">
                {c.risk.signals.map((s) => (
                  <li key={s.label} className="flex justify-between gap-2">
                    <span>{s.label}</span>
                    <span className="tabular-nums text-slate-500">+{s.points}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {c.b2b && (
            <Card
              title="Business (B2B)"
              actions={
                can('customers:approve') &&
                c.b2b.status !== 'VERIFIED' && (
                  <>
                    <Btn size="sm" tone="primary" onClick={() => setDialog('b2b-verify')}>
                      Verify
                    </Btn>
                    {c.b2b.status !== 'REJECTED' && (
                      <Btn size="sm" onClick={() => setDialog('b2b-reject')}>
                        Reject
                      </Btn>
                    )}
                  </>
                )
              }
            >
              <KeyValues
                columns={1}
                items={[
                  ['Business', c.b2b.businessName],
                  [
                    'GSTIN',
                    <span key="g" className="font-mono">
                      {c.b2b.gstin}
                    </span>,
                  ],
                  [
                    'PAN',
                    <span key="p" className="font-mono">
                      {c.b2b.pan}
                    </span>,
                  ],
                  [
                    'Billing address',
                    [
                      c.b2b.billingLine1,
                      c.b2b.billingLine2,
                      `${c.b2b.billingCity}, ${c.b2b.billingState} ${c.b2b.billingPincode}`,
                    ]
                      .filter(Boolean)
                      .join(', '),
                  ],
                  ['Submitted', date(c.b2b.submittedAt)],
                  ...(c.b2b.rejectionReason
                    ? ([['Rejected because', c.b2b.rejectionReason]] as Array<[string, string]>)
                    : []),
                ]}
              />
              <p className="mt-3 text-xs text-slate-500">
                Check the GSTIN on the{' '}
                <a
                  className="text-teal-600 underline"
                  href="https://services.gst.gov.in/services/searchtp"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GST portal
                </a>{' '}
                before verifying.
              </p>
            </Card>
          )}

          <Card title="Shortcuts">
            <ul className="space-y-1 text-sm">
              <li>
                <Link className="text-teal-600 hover:underline" href={`/orders?customerId=${c.id}`}>
                  All orders
                </Link>
              </li>
              <li>
                <Link
                  className="text-teal-600 hover:underline"
                  href={`/audit-log?entity=customer&entityId=${c.id}`}
                >
                  Staff actions on this customer
                </Link>
              </li>
            </ul>
          </Card>
        </div>
      </div>

      <ReasonDialog
        open={dialog === 'block'}
        tone="danger"
        title="Block this customer"
        confirmLabel="Block"
        description="They’re signed out everywhere and can’t sign in or order until unblocked."
        onClose={() => setDialog(null)}
        onConfirm={post('/status', 'PATCH', { status: 'BLOCKED' })}
      />
      <ReasonDialog
        open={dialog === 'unblock'}
        title="Unblock this customer"
        confirmLabel="Unblock"
        onClose={() => setDialog(null)}
        onConfirm={post('/status', 'PATCH', { status: 'ACTIVE' })}
      />
      <ReasonDialog
        open={dialog === 'cod'}
        title={c.codDisabled ? 'Allow cash on delivery' : 'Disable cash on delivery'}
        confirmLabel={c.codDisabled ? 'Allow COD' : 'Disable COD'}
        description={
          c.codDisabled
            ? undefined
            : 'They can still pay online. Use this after repeated refused COD parcels.'
        }
        onClose={() => setDialog(null)}
        onConfirm={post('/cod', 'PATCH', { disabled: !c.codDisabled })}
      />
      <ReasonDialog
        open={dialog === 'b2b-verify'}
        title="Verify business details"
        confirmLabel="Verify"
        reasonRequired={false}
        reasonLabel="Note (optional)"
        description="They can then download GST invoices with their GSTIN and claim input tax credit."
        onClose={() => setDialog(null)}
        onConfirm={post('/b2b', 'POST', { decision: 'VERIFIED' })}
      />
      <ReasonDialog
        open={dialog === 'b2b-reject'}
        tone="danger"
        title="Reject business details"
        confirmLabel="Reject"
        reasonLabel="Reason (shown to the customer)"
        onClose={() => setDialog(null)}
        onConfirm={post('/b2b', 'POST', { decision: 'REJECTED' })}
      />
      <ReasonDialog
        open={dialog === 'wallet'}
        title="Adjust wallet"
        confirmLabel={direction === 'CREDIT' ? 'Add to wallet' : 'Take from wallet'}
        description={`Balance now: ${money(c.wallet.balancePaise)} and ${count(c.wallet.coins)} coins. Every adjustment is a ledger entry.`}
        canConfirm={(amount ?? 0) > 0 || (coins ?? 0) > 0}
        onClose={() => setDialog(null)}
        onConfirm={post('/wallet-adjustment', 'POST', {
          direction,
          amountRupees: amount ?? 0,
          coins: coins ?? 0,
        })}
      >
        <ListSelect
          label="Type"
          value={direction}
          onChange={(value) => setDirection(value as 'CREDIT' | 'DEBIT')}
          options={[
            { value: 'CREDIT', label: 'Credit (add)' },
            { value: 'DEBIT', label: 'Debit (take away)' },
          ]}
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <NumberInput
            label="Amount"
            unit="₹"
            value={amount}
            onChange={setAmount}
            min={0}
            max={100000}
            step={0.01}
          />
          <NumberInput label="Coins" value={coins} onChange={setCoins} min={0} max={1000000} />
        </div>
      </ReasonDialog>
    </div>
  );
}
