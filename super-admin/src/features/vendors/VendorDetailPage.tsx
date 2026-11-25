'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  ErrorState,
  KeyValues,
  LinkBtn,
  Loading,
  NumberInput,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  Tabs,
  TextArea,
  useAction,
} from '@/components/ui';
import { Checkbox } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { date, dateTime, humanize, money, moneyWhole } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { DocumentViewer } from './DocumentViewer';
import { DOCUMENT_TYPES, type VendorDetail } from './types';

type TabKey = 'overview' | 'kyc' | 'products' | 'orders' | 'trust' | 'notes';
type Dialog =
  | null
  | 'approve'
  | 'reject'
  | 'documents'
  | 'suspend'
  | 'reinstate'
  | 'commission'
  | 'verified'
  | 'hold'
  | 'review';

function TrustChart({ points }: { points: Array<{ date: string; score: number }> }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-sm text-slate-500">Not enough history yet.</p>;
  const W = 600;
  const H = 160;
  const pad = { l: 32, r: 8, t: 10, b: 22 };
  const min = Math.max(0, Math.min(...points.map((p) => p.score)) - 5);
  const max = Math.min(100, Math.max(...points.map((p) => p.score)) + 5);
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / Math.max(1, max - min)) * (H - pad.t - pad.b);
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i)},${y(p.score)}`).join('');
  const active = hover === null ? null : points[hover];
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Trust Score over time"
      >
        {[min, (min + max) / 2, max].map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#E5E7EB" />
            <text
              x={pad.l - 6}
              y={y(t)}
              dy="0.32em"
              textAnchor="end"
              fontSize={10}
              className="fill-slate-500"
            >
              {Math.round(t)}
            </text>
          </g>
        ))}
        <path
          d={line}
          fill="none"
          stroke="#1F9E8C"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {active && hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={H - pad.b} stroke="#CBD5E1" />
            <circle
              cx={x(hover)}
              cy={y(active.score)}
              r={5}
              fill="#1F9E8C"
              stroke="#fff"
              strokeWidth={2}
            />
          </>
        )}
        <text x={pad.l} y={H - 6} fontSize={10} className="fill-slate-500">
          {date(points[0].date)}
        </text>
        <text x={W - pad.r} y={H - 6} fontSize={10} textAnchor="end" className="fill-slate-500">
          {date(points[points.length - 1].date)}
        </text>
        {points.map((p, i) => (
          <rect
            key={p.date}
            x={x(i) - (W - pad.l - pad.r) / points.length / 2}
            y={pad.t}
            width={(W - pad.l - pad.r) / points.length}
            height={H - pad.t - pad.b}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {active && (
        <div className="pointer-events-none absolute end-2 top-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow">
          {date(active.date)}: <span className="font-semibold text-navy">{active.score}</span>
        </div>
      )}
    </div>
  );
}

function CheckRow({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
      <div className="min-w-0">
        <p className="text-sm text-navy">{label}</p>
        {detail && <p className="break-words text-xs text-slate-500">{detail}</p>}
      </div>
      <StatusBadge value={value} />
    </div>
  );
}

/** Vendor detail (5.2 VendorDetail + VendorControls + KYC review). */
export function VendorDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const run = useAction();
  const { data: v, error, reload, setData } = useApi<VendorDetail>(`/admin/vendors/${id}`);
  const { data: reasonsData } = useApi<{ reasons: string[] }>(
    can('vendors:approve') ? '/admin/kyc/reasons' : null,
  );
  const [tab, setTab] = useState<TabKey>('overview');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [docs, setDocs] = useState<string[]>([]);
  const [commission, setCommission] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [noteKind, setNoteKind] = useState<'NOTE' | 'WARNING'>('NOTE');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab');
    if (
      requested &&
      ['overview', 'kyc', 'products', 'orders', 'trust', 'notes'].includes(requested)
    )
      setTab(requested as TabKey);
  }, []);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!v) return <Loading />;

  const act = (path: string, method: 'POST' | 'PATCH', body: object) => async (reason: string) => {
    const result = await apiFetch<VendorDetail>(path, { method, body: { ...body, reason } });
    setData(result);
  };
  const vendorPanel = process.env.NEXT_PUBLIC_VENDOR_PANEL_URL;
  const canEdit = can('vendors:edit');
  const kycOpen = v.kyc && ['SUBMITTED', 'MORE_INFO_REQUIRED', 'REJECTED'].includes(v.kyc.status);

  return (
    <div>
      <PageHeader
        back={{ href: '/vendors', label: 'Vendors' }}
        title={v.name}
        description={v.legalName ?? undefined}
        meta={
          <>
            <StatusBadge value={v.status} />
            {v.kyc && <StatusBadge value={v.kyc.status} label={`KYC: ${humanize(v.kyc.status)}`} />}
            {v.isVerified && <Badge tone="success">Trustlon Verified</Badge>}
            {v.isPlatformOwned && <Badge tone="navy">Own brand</Badge>}
            {v.underReview && <Badge tone="warning">Suspension review open</Badge>}
            {v.payoutsOnHold && <Badge tone="danger">Payouts on hold</Badge>}
          </>
        }
        actions={
          vendorPanel ? (
            <LinkBtn
              href={`${vendorPanel.replace(/\/$/, '')}/dashboard?vendor=${v.id}`}
              external
              size="sm"
            >
              Open vendor dashboard
            </LinkBtn>
          ) : undefined
        }
      />

      {v.status === 'SUSPENDED' && v.suspensionReason && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          Suspended {date(v.suspendedAt)}: {v.suspensionReason}. Its products are hidden from the
          store.
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0">
          <Tabs<TabKey>
            label="Vendor sections"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'overview', label: 'Overview' },
              { key: 'kyc', label: 'KYC and documents', count: v.documents.length },
              {
                key: 'products',
                label: 'Products',
                count: Object.values(v.products.counts).reduce((a, b) => a + b, 0),
              },
              {
                key: 'orders',
                label: 'Orders',
                count: Object.values(v.orders.counts).reduce((a, b) => a + b, 0),
              },
              { key: 'trust', label: 'Trust Score' },
              { key: 'notes', label: 'Notes', count: v.notes.length },
            ]}
          />

          {tab === 'overview' && (
            <Card>
              <KeyValues
                items={[
                  ['Display name', v.name],
                  ['Legal name', v.legalName],
                  ['GSTIN', v.gstin && <span className="font-mono">{v.gstin}</span>],
                  ['Plan', humanize(v.plan)],
                  [
                    'Owner',
                    v.owner ? `${v.owner.fullName} · ${v.owner.email} · ${v.owner.mobile}` : '—',
                  ],
                  ['Pickup PIN code', v.pickupPincode],
                  ['Lifetime GMV', moneyWhole(v.gmvPaise)],
                  ['Trust Score', v.trustScore],
                  [
                    'Commission',
                    v.commissionPercent === null
                      ? 'Category rate'
                      : `${v.commissionPercent}% (vendor rate)`,
                  ],
                  ['Joined', date(v.joinedAt)],
                  ['KYC approved', date(v.kycApprovedAt)],
                  [
                    'Store page',
                    <a
                      key="s"
                      className="text-teal-600 hover:underline"
                      href={`${process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000'}/store/${v.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      /store/{v.slug}
                    </a>,
                  ],
                ]}
              />
            </Card>
          )}

          {tab === 'kyc' && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card title="Documents">
                <DocumentViewer vendorId={v.id} documents={v.documents} />
              </Card>
              <div className="space-y-5">
                <Card
                  title="Verification results"
                  description={
                    v.kyc?.submittedAt ? `Submitted ${dateTime(v.kyc.submittedAt)}` : undefined
                  }
                >
                  {!v.kyc ? (
                    <p className="text-sm text-slate-500">This vendor hasn’t submitted KYC yet.</p>
                  ) : (
                    <>
                      <CheckRow
                        label={`PAN ${v.kyc.pan ?? ''}`}
                        value={v.kyc.panCheck}
                        detail={v.kyc.panName}
                      />
                      <CheckRow
                        label={`GSTIN ${v.kyc.gstin ?? ''}`}
                        value={v.kyc.gstinCheck}
                        detail={v.kyc.gstinLegalName}
                      />
                      <CheckRow
                        label={`Bank ${v.kyc.bankAccount ?? ''} · ${v.kyc.ifsc ?? ''}`}
                        value={v.kyc.pennyDropCheck}
                        detail={[
                          v.kyc.bankName,
                          v.kyc.pennyDropName && `Name on account: ${v.kyc.pennyDropName}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      />
                      <div className="mt-3 text-sm">
                        {v.kyc.nameMatch === null ? null : v.kyc.nameMatch ? (
                          <Badge tone="success">PAN name matches the bank account</Badge>
                        ) : (
                          <Badge tone="danger">PAN name and bank account name differ</Badge>
                        )}
                      </div>
                      {v.kyc.requestedDocuments.length > 0 && (
                        <p className="mt-3 text-sm text-amber-700">
                          Asked for:{' '}
                          {v.kyc.requestedDocuments.map((d) => DOCUMENT_TYPES[d] ?? d).join(', ')}.{' '}
                          {v.kyc.reviewNote}
                        </p>
                      )}
                      {v.kyc.rejectionReasons.length > 0 && (
                        <ul className="mt-3 list-disc ps-5 text-sm text-red-700">
                          {v.kyc.rejectionReasons.map((r) => (
                            <li key={r}>{r}</li>
                          ))}
                        </ul>
                      )}
                    </>
                  )}
                </Card>
                {kycOpen && can('vendors:approve') && (
                  <Card title="Decision">
                    <div className="flex flex-wrap gap-2">
                      <Btn tone="primary" onClick={() => setDialog('approve')}>
                        Approve
                      </Btn>
                      {v.kyc?.status !== 'REJECTED' && (
                        <>
                          <Btn
                            onClick={() => {
                              setDocs([]);
                              setDialog('documents');
                            }}
                          >
                            Request more documents
                          </Btn>
                          <Btn
                            tone="danger"
                            onClick={() => {
                              setReasons([]);
                              setDialog('reject');
                            }}
                          >
                            Reject
                          </Btn>
                        </>
                      )}
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {tab === 'products' && (
            <Card
              title="Products"
              description={Object.entries(v.products.counts)
                .map(([k, n]) => `${humanize(k)} ${n}`)
                .join(' · ')}
              actions={
                <LinkBtn size="sm" href={`/catalog/products?tab=all&vendorId=${v.id}`}>
                  See all
                </LinkBtn>
              }
              padded={false}
            >
              <ul className="divide-y divide-slate-100">
                {v.products.recent.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.imageUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-md bg-slate-100 object-cover"
                    />
                    <Link
                      href={`/catalog/products/${p.id}`}
                      className="min-w-0 flex-1 truncate text-sm text-navy hover:text-teal-600"
                    >
                      {p.name}
                    </Link>
                    <span className="hidden text-sm tabular-nums text-slate-600 sm:inline">
                      {money(p.pricePaise)}
                    </span>
                    <StatusBadge value={p.status} />
                  </li>
                ))}
                {v.products.recent.length === 0 && (
                  <li className="px-4 py-6 text-sm text-slate-500">No products yet.</li>
                )}
              </ul>
            </Card>
          )}

          {tab === 'orders' && (
            <Card
              title="Recent orders"
              actions={
                <LinkBtn size="sm" href={`/orders?vendorId=${v.id}`}>
                  See all
                </LinkBtn>
              }
              padded={false}
            >
              <ul className="divide-y divide-slate-100">
                {v.orders.recent.map((o) => (
                  <li
                    key={o.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
                  >
                    <Link
                      href={`/orders/${o.orderId}`}
                      className="font-mono text-navy hover:text-teal-600"
                    >
                      {o.subOrderNumber}
                    </Link>
                    <span className="text-slate-500">{date(o.createdAt)}</span>
                    <span className="tabular-nums">{money(o.totalPaise)}</span>
                    <StatusBadge value={o.status} />
                  </li>
                ))}
                {v.orders.recent.length === 0 && (
                  <li className="px-4 py-6 text-sm text-slate-500">No orders yet.</li>
                )}
              </ul>
              <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                Payouts and settlement statements arrive with the Finance panel (Phase 2).{' '}
                {v.payoutsOnHold
                  ? `Payouts are on hold: ${v.payoutHoldReason ?? ''}`
                  : 'Payouts are not on hold.'}
              </p>
            </Card>
          )}

          {tab === 'trust' && (
            <Card title="Trust Score, last 90 days" description={`Current score ${v.trustScore}`}>
              <TrustChart points={v.trustScoreHistory} />
            </Card>
          )}

          {tab === 'notes' && (
            <Card title="Notes and warnings">
              {canEdit && (
                <form
                  className="mb-4 space-y-3"
                  onSubmit={async (e) => {
                    e.preventDefault();
                    setSaving(true);
                    const result = await run(
                      () =>
                        apiFetch<VendorDetail>(`/admin/vendors/${v.id}/notes`, {
                          method: 'POST',
                          body: { body: note, kind: noteKind },
                        }),
                      noteKind === 'WARNING' ? 'Warning recorded' : 'Note added',
                    );
                    if (result) {
                      setData(result);
                      setNote('');
                    }
                    setSaving(false);
                  }}
                >
                  <TextArea
                    label="Add a note (staff only)"
                    value={note}
                    onChange={setNote}
                    maxLength={2000}
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Checkbox
                      label="This is a warning to the vendor"
                      checked={noteKind === 'WARNING'}
                      onChange={(e) => setNoteKind(e.target.checked ? 'WARNING' : 'NOTE')}
                    />
                    <Btn
                      type="submit"
                      tone="primary"
                      size="sm"
                      loading={saving}
                      disabled={note.trim().length < 2}
                    >
                      Save note
                    </Btn>
                  </div>
                </form>
              )}
              <ul className="space-y-3">
                {v.notes.map((n) => (
                  <li key={n.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      {n.kind === 'WARNING' && <Badge tone="warning">Warning</Badge>}
                      {n.by} · {dateTime(n.at)}
                    </div>
                    <p className="whitespace-pre-line text-navy">{n.body}</p>
                  </li>
                ))}
                {v.notes.length === 0 && <li className="text-sm text-slate-500">No notes yet.</li>}
              </ul>
            </Card>
          )}
        </div>

        {canEdit && (
          <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
            <Card title="Controls">
              <div className="space-y-2">
                {v.status === 'SUSPENDED' ? (
                  <Btn className="w-full" tone="primary" onClick={() => setDialog('reinstate')}>
                    Reinstate vendor
                  </Btn>
                ) : (
                  !v.isPlatformOwned && (
                    <Btn className="w-full" tone="danger" onClick={() => setDialog('suspend')}>
                      Suspend vendor
                    </Btn>
                  )
                )}
                <Btn
                  className="w-full"
                  onClick={() => setDialog('verified')}
                  disabled={!v.isVerified && v.status !== 'ACTIVE'}
                >
                  {v.isVerified ? 'Remove Verified badge' : 'Grant Trustlon Verified badge'}
                </Btn>
                <Btn
                  className="w-full"
                  onClick={() => {
                    setCommission(v.commissionPercent);
                    setDialog('commission');
                  }}
                >
                  Set commission rate
                </Btn>
                <Btn className="w-full" onClick={() => setDialog('hold')}>
                  {v.payoutsOnHold ? 'Release payouts' : 'Hold payouts'}
                </Btn>
                <Btn className="w-full" onClick={() => setDialog('review')}>
                  {v.underReview ? 'Close suspension review' : 'Open suspension review'}
                </Btn>
              </div>
            </Card>
          </aside>
        )}
      </div>

      <ReasonDialog
        open={dialog === 'approve'}
        title="Approve KYC"
        description={`${v.name} becomes active and can start listing products.`}
        confirmLabel="Approve"
        reasonRequired={false}
        reasonLabel="Note (optional)"
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/kyc/${v.id}/approve`, 'POST', {})}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        title="Reject KYC"
        description="The vendor sees these reasons and can submit again."
        confirmLabel="Reject"
        tone="danger"
        reasonLabel="Message to the vendor (optional)"
        reasonRequired={false}
        canConfirm={reasons.length > 0}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => {
          setData(
            await apiFetch<VendorDetail>(`/admin/kyc/${v.id}/reject`, {
              method: 'POST',
              body: { reasons, note: note || undefined },
            }),
          );
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-navy">Reasons</legend>
          {(reasonsData?.reasons ?? []).map((r) => (
            <Checkbox
              key={r}
              label={r}
              checked={reasons.includes(r)}
              onChange={(e) =>
                setReasons((cur) => (e.target.checked ? [...cur, r] : cur.filter((x) => x !== r)))
              }
            />
          ))}
        </fieldset>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === 'documents'}
        title="Request more documents"
        confirmLabel="Send request"
        reasonLabel="What’s missing (sent to the vendor)"
        canConfirm={docs.length > 0}
        onClose={() => setDialog(null)}
        onConfirm={async (note) => {
          setData(
            await apiFetch<VendorDetail>(`/admin/kyc/${v.id}/request-documents`, {
              method: 'POST',
              body: { documents: docs, note },
            }),
          );
        }}
      >
        <fieldset className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <legend className="mb-1 text-sm font-medium text-navy">Documents</legend>
          {Object.entries(DOCUMENT_TYPES).map(([key, label]) => (
            <Checkbox
              key={key}
              label={label}
              checked={docs.includes(key)}
              onChange={(e) =>
                setDocs((cur) => (e.target.checked ? [...cur, key] : cur.filter((x) => x !== key)))
              }
            />
          ))}
        </fieldset>
      </ReasonDialog>
      <ReasonDialog
        open={dialog === 'suspend'}
        title={`Suspend ${v.name}?`}
        description="The vendor and all its products disappear from the store immediately. Orders already placed continue."
        confirmLabel="Suspend"
        tone="danger"
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/vendors/${v.id}/suspend`, 'POST', {})}
      />
      <ReasonDialog
        open={dialog === 'reinstate'}
        title={`Reinstate ${v.name}?`}
        description="Its live products come back to the store."
        confirmLabel="Reinstate"
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/vendors/${v.id}/reinstate`, 'POST', {})}
      />
      <ReasonDialog
        open={dialog === 'verified'}
        title={v.isVerified ? 'Remove the Verified badge' : 'Grant the Trustlon Verified badge'}
        confirmLabel={v.isVerified ? 'Remove badge' : 'Grant badge'}
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/vendors/${v.id}/verified`, 'PATCH', { value: !v.isVerified })}
      />
      <ReasonDialog
        open={dialog === 'commission'}
        title="Vendor commission rate"
        description="A vendor rate overrides the category rate. Leave empty to use the category rate again."
        confirmLabel="Save rate"
        canConfirm={commission === null || (commission >= 0 && commission <= 50)}
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/vendors/${v.id}/commission`, 'PATCH', {
          commissionPercent: commission,
        })}
      >
        <NumberInput
          label="Commission"
          unit="% of item price"
          value={commission}
          onChange={setCommission}
          min={0}
          max={50}
          step={0.1}
        />
      </ReasonDialog>
      <ReasonDialog
        open={dialog === 'hold'}
        title={v.payoutsOnHold ? 'Release payouts' : 'Hold payouts'}
        description={
          v.payoutsOnHold
            ? 'Payouts resume on the next cycle.'
            : 'No money is paid to this vendor until you release it.'
        }
        confirmLabel={v.payoutsOnHold ? 'Release' : 'Hold payouts'}
        tone={v.payoutsOnHold ? 'primary' : 'danger'}
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/vendors/${v.id}/payout-hold`, 'PATCH', { value: !v.payoutsOnHold })}
      />
      <ReasonDialog
        open={dialog === 'review'}
        title={v.underReview ? 'Close the suspension review' : 'Open a suspension review'}
        description="A review flags the vendor in Trust and safety while the team decides. The store is not affected."
        confirmLabel={v.underReview ? 'Close review' : 'Open review'}
        onClose={() => setDialog(null)}
        onConfirm={act(`/admin/vendors/${v.id}/review`, 'PATCH', { value: !v.underReview })}
      />
    </div>
  );
}
