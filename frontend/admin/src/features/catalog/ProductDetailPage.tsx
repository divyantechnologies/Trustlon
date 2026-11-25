'use client';

import { useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  ErrorState,
  KeyValues,
  LinkBtn,
  Loading,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  useAction,
} from '@/components/ui';
import { ListSelect } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { date, dateTime, humanize, money } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { FIELD_LABELS, showValue } from './ProductsPage';

interface Submission {
  id: string;
  kind: string;
  status: string;
  changes: Array<{ field: string; before: unknown; after: unknown }>;
  submittedAt: string;
  decidedAt: string | null;
  reason: string | null;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  brand: string | null;
  description: string | null;
  imageUrl: string;
  images: string[];
  pricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  stock: number;
  status: string;
  hsnCode: string | null;
  codAllowed: boolean;
  badge: string | null;
  rejectionReason: string | null;
  authenticity: string;
  authenticityNote: string | null;
  needsAuthenticityCheck: boolean;
  ratingAvg: number;
  ratingCount: number;
  salesCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  vendor: {
    id: string;
    displayName: string;
    status: string;
    isVerified: boolean;
    trustScore: number;
  };
  category: { id: string; name: string; slug: string };
  submissions: Submission[];
}

type Dialog =
  | null
  | 'approve'
  | 'reject'
  | 'changes'
  | 'authenticity'
  | 'deactivate'
  | 'reactivate';

/** Moderation view of one product: preview, change diff and actions (5.4). */
export function ProductDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const run = useAction();
  const { data: p, error, reload, setData } = useApi<Product>(`/admin/products/${id}`);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [authStatus, setAuthStatus] = useState('VERIFIED');
  void run;

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!p) return <Loading />;

  const pending = p.submissions.find((s) => s.status === 'PENDING');
  const awaiting = Boolean(pending) || ['PENDING_APPROVAL', 'CHANGES_REQUESTED'].includes(p.status);
  const post = (path: string, body: object) => async (reason: string) =>
    setData(
      await apiFetch<Product>(`/admin/products/${p.id}/${path}`, {
        method: 'POST',
        body: { ...body, reason: reason || undefined },
      }),
    );
  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

  return (
    <div>
      <PageHeader
        back={{ href: '/catalog/products', label: 'Products' }}
        title={p.name}
        meta={
          <>
            <StatusBadge value={p.status} />
            {p.authenticity !== 'NOT_REQUIRED' && (
              <StatusBadge
                value={p.authenticity}
                label={`Authenticity: ${humanize(p.authenticity)}`}
              />
            )}
            {p.needsAuthenticityCheck && (
              <Badge tone="warning">High value: authenticity check suggested</Badge>
            )}
            {pending && (
              <Badge tone="warning">
                {pending.kind === 'EDIT' ? 'Edit waiting' : 'New listing waiting'}
              </Badge>
            )}
          </>
        }
        actions={
          p.status === 'LIVE' && (
            <LinkBtn href={`${storefront}/p/${p.slug}`} external size="sm">
              View on store
            </LinkBtn>
          )
        }
      />
      {p.rejectionReason && ['REJECTED', 'CHANGES_REQUESTED', 'INACTIVE'].includes(p.status) && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Last decision: {p.rejectionReason}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-5">
          {pending && pending.changes.length > 0 && (
            <Card
              title="Changes in this edit"
              description={`Submitted ${dateTime(pending.submittedAt)}`}
              padded={false}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs text-slate-500">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Field</th>
                      <th className="px-4 py-2 font-semibold">Now</th>
                      <th className="px-4 py-2 font-semibold">Proposed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pending.changes.map((c) => (
                      <tr key={c.field} className="align-top">
                        <td className="px-4 py-2 font-medium text-navy">
                          {FIELD_LABELS[c.field] ?? c.field}
                        </td>
                        <td className="px-4 py-2 text-slate-500 line-through decoration-red-400">
                          {showValue(c.field, c.before)}
                        </td>
                        <td className="bg-teal-50/60 px-4 py-2 text-navy">
                          {showValue(c.field, c.after)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          <Card title="Listing preview">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.imageUrl}
                  alt=""
                  className="h-48 w-48 rounded-lg bg-slate-100 object-cover"
                />
                {p.images.length > 0 && (
                  <div className="mt-2 flex gap-1">
                    {p.images.slice(0, 4).map((src) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={src}
                        src={src}
                        alt=""
                        className="h-11 w-11 rounded bg-slate-100 object-cover"
                      />
                    ))}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {p.brand && (
                  <p className="text-xs uppercase tracking-wide text-slate-500">{p.brand}</p>
                )}
                <p className="text-lg font-semibold text-navy">{p.name}</p>
                <p className="mt-1">
                  <span className="text-lg font-semibold text-navy">{money(p.pricePaise)}</span>{' '}
                  {p.mrpPaise > p.pricePaise && (
                    <>
                      <span className="text-sm text-slate-500 line-through">
                        {money(p.mrpPaise)}
                      </span>{' '}
                      <span className="text-sm text-teal-600">{p.discountPercent}% off</span>
                    </>
                  )}
                </p>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-700">
                  {p.description || 'No description.'}
                </p>
              </div>
            </div>
          </Card>
          <Card title="Details">
            <KeyValues
              items={[
                [
                  'Vendor',
                  `${p.vendor.displayName} · Trust Score ${p.vendor.trustScore}${p.vendor.isVerified ? ' · Verified' : ''}`,
                ],
                ['Vendor status', humanize(p.vendor.status)],
                ['Category', p.category.name],
                ['HSN code', p.hsnCode],
                ['Stock', p.stock],
                ['Cash on delivery', p.codAllowed ? 'Allowed' : 'Not allowed'],
                [
                  'Rating',
                  p.ratingCount ? `${p.ratingAvg} from ${p.ratingCount} reviews` : 'No reviews',
                ],
                ['Sold', p.salesCount],
                ['Created', date(p.createdAt)],
                ['Approved', date(p.approvedAt)],
                ['Authenticity note', p.authenticityNote],
              ]}
            />
          </Card>
          {p.submissions.length > 0 && (
            <Card title="Moderation history" padded={false}>
              <ul className="divide-y divide-slate-100 text-sm">
                {p.submissions.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5"
                  >
                    <span>
                      {s.kind === 'EDIT' ? 'Edit' : 'New listing'} · {dateTime(s.submittedAt)}
                      {s.reason && <span className="text-slate-500"> · {s.reason}</span>}
                    </span>
                    <StatusBadge value={s.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-3 xl:sticky xl:top-20 xl:self-start">
          {can('products:approve') && awaiting && (
            <Card title="Decision">
              <div className="space-y-2">
                <Btn
                  className="w-full"
                  tone="primary"
                  onClick={() => setDialog('approve')}
                  disabled={p.authenticity === 'FLAGGED' || p.authenticity === 'FAILED'}
                >
                  Approve{pending?.kind === 'EDIT' ? ' edit' : ''}
                </Btn>
                {p.authenticity === 'FLAGGED' && (
                  <p className="text-xs text-amber-700">Finish the authenticity check first.</p>
                )}
                <Btn className="w-full" onClick={() => setDialog('changes')}>
                  Request changes
                </Btn>
                <Btn className="w-full" tone="danger" onClick={() => setDialog('reject')}>
                  Reject
                </Btn>
              </div>
            </Card>
          )}
          {can('products:approve') && (
            <Card title="Authenticity check" description="For high-value or branded goods">
              <Btn className="w-full" onClick={() => setDialog('authenticity')}>
                {p.authenticity === 'NOT_REQUIRED'
                  ? 'Flag for authenticity check'
                  : 'Record result'}
              </Btn>
            </Card>
          )}
          {can('products:edit') && (p.status === 'LIVE' || p.status === 'INACTIVE') && (
            <Card title="Visibility">
              {p.status === 'LIVE' ? (
                <Btn className="w-full" tone="danger" onClick={() => setDialog('deactivate')}>
                  Deactivate listing
                </Btn>
              ) : (
                <Btn className="w-full" onClick={() => setDialog('reactivate')}>
                  Reactivate listing
                </Btn>
              )}
            </Card>
          )}
        </aside>
      </div>

      <ReasonDialog
        open={dialog === 'approve'}
        title="Approve"
        description={
          pending?.kind === 'EDIT'
            ? 'The proposed changes go live.'
            : 'The product goes live on the store.'
        }
        confirmLabel="Approve"
        reasonRequired={false}
        reasonLabel="Note (optional)"
        onClose={() => setDialog(null)}
        onConfirm={post('approve', {})}
      />
      <ReasonDialog
        open={dialog === 'changes'}
        title="Request changes"
        description="The vendor sees your message and can edit and resubmit."
        confirmLabel="Send to vendor"
        reasonLabel="What needs to change"
        onClose={() => setDialog(null)}
        onConfirm={post('request-changes', {})}
      />
      <ReasonDialog
        open={dialog === 'reject'}
        title="Reject"
        description={
          pending?.kind === 'EDIT' && p.status === 'LIVE'
            ? 'Only the edit is rejected; the live listing stays as it is.'
            : 'The listing won’t go live.'
        }
        confirmLabel="Reject"
        tone="danger"
        reasonLabel="Reason (sent to the vendor)"
        onClose={() => setDialog(null)}
        onConfirm={post('reject', {})}
      />
      <ReasonDialog
        open={dialog === 'authenticity'}
        title="Authenticity check"
        confirmLabel="Save"
        reasonLabel="Note"
        tone={authStatus === 'FAILED' ? 'danger' : 'primary'}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) =>
          setData(
            await apiFetch<Product>(`/admin/products/${p.id}/authenticity`, {
              method: 'POST',
              body: { status: authStatus, note: reason },
            }),
          )
        }
      >
        <ListSelect
          label="Result"
          value={authStatus}
          onChange={setAuthStatus}
          options={[
            {
              value: 'FLAGGED',
              label: 'Flag: check needed',
              detail: 'Blocks approval until recorded',
            },
            { value: 'VERIFIED', label: 'Verified genuine' },
            { value: 'FAILED', label: 'Failed', detail: 'Deactivates the listing' },
            { value: 'NOT_REQUIRED', label: 'Not needed' },
          ]}
        />
      </ReasonDialog>
      <ReasonDialog
        open={dialog === 'deactivate'}
        title="Deactivate listing"
        description="The product disappears from the store until reactivated."
        confirmLabel="Deactivate"
        tone="danger"
        onClose={() => setDialog(null)}
        onConfirm={post('deactivate', {})}
      />
      <ReasonDialog
        open={dialog === 'reactivate'}
        title="Reactivate listing"
        confirmLabel="Reactivate"
        onClose={() => setDialog(null)}
        onConfirm={post('reactivate', {})}
      />
    </div>
  );
}
