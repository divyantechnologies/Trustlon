'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Btn,
  EmptyState,
  ErrorState,
  FilterSelect,
  Loading,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  Tabs,
  Toolbar,
} from '@/components/ui';
import { ListSelect } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { ago, dateTime, humanize, money } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';

interface Report {
  id: string;
  targetType: 'PRODUCT' | 'REVIEW' | 'VENDOR';
  targetId: string;
  target: Record<string, unknown> | null;
  reason: string;
  details: string | null;
  reporter: { kind: string; name: string };
  status: string;
  action: string | null;
  resolutionNote: string | null;
  reportsOnTarget: number;
  createdAt: string;
  handledAt: string | null;
}

const ACTIONS: Record<
  Report['targetType'],
  Array<{ value: string; label: string; detail?: string }>
> = {
  PRODUCT: [
    { value: 'delist_product', label: 'Delist the product', detail: 'Hidden from the store' },
    { value: 'warn_vendor', label: 'Warn the vendor', detail: 'Note on the vendor' },
    {
      value: 'open_suspension_review',
      label: 'Open a suspension review',
      detail: 'Vendor under review',
    },
    { value: 'dismiss', label: 'Dismiss', detail: 'Nothing wrong' },
  ],
  REVIEW: [
    { value: 'remove_review', label: 'Remove the review' },
    { value: 'publish_review', label: 'Keep the review published' },
    { value: 'dismiss', label: 'Dismiss' },
  ],
  VENDOR: [
    { value: 'warn_vendor', label: 'Warn the vendor' },
    { value: 'open_suspension_review', label: 'Open a suspension review' },
    { value: 'dismiss', label: 'Dismiss' },
  ],
};

function TargetSummary({ r }: { r: Report }) {
  const t = r.target as Record<string, any> | null;
  if (!t)
    return (
      <p className="text-sm text-slate-500">This {r.targetType.toLowerCase()} no longer exists.</p>
    );
  if (r.targetType === 'PRODUCT') {
    return (
      <div className="flex gap-3">
        {t.imageUrl ? (
          <img
            src={t.imageUrl}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <Link
            href={`/catalog/products/${t.id}`}
            className="break-words font-medium text-navy hover:text-teal-600"
          >
            {t.name}
          </Link>
          <p className="text-xs text-slate-500">
            {money(t.pricePaise)} ·{' '}
            <Link className="text-teal-600 hover:underline" href={`/vendors/${t.vendor.id}`}>
              {t.vendor.displayName}
            </Link>{' '}
            · {humanize(t.status)}
          </p>
        </div>
      </div>
    );
  }
  if (r.targetType === 'REVIEW') {
    return (
      <div className="min-w-0">
        <p className="font-medium text-navy">
          {'★'.repeat(t.rating)} {t.title}
        </p>
        <p className="line-clamp-3 break-words text-sm text-slate-600">{t.body}</p>
        <p className="text-xs text-slate-500">
          On {t.product.name} · {t.product.vendor.displayName} · {humanize(t.status)}
        </p>
      </div>
    );
  }
  return (
    <p className="text-sm">
      <Link href={`/vendors/${t.id}`} className="font-medium text-navy hover:text-teal-600">
        {t.displayName}
      </Link>{' '}
      <span className="text-slate-500">
        · Trust Score {t.trustScore} · {humanize(t.status)}
      </span>
    </p>
  );
}

/** Reports (5.8 ReportedListings): counterfeit, prohibited or misleading listings, abusive reviews and sellers. */
export function ReportsPage() {
  const { can } = useAuth();
  const [f, setF] = useQueryState({ status: 'OPEN', targetType: '' });
  const { data, error, reload } = useApi<{ items: Report[] }>(
    `/admin/reports?status=${f.status}${f.targetType ? `&targetType=${f.targetType}` : ''}`,
  );
  const [handling, setHandling] = useState<Report | null>(null);
  const [action, setAction] = useState('');

  return (
    <div>
      <PageHeader
        title="Reports"
        description="What customers, vendors and automatic checks have reported. Every decision is saved with your note."
      />
      <Tabs
        label="Report status"
        value={f.status as 'OPEN' | 'ACTIONED' | 'DISMISSED'}
        onChange={(status) => setF({ status })}
        tabs={[
          { key: 'OPEN', label: 'Open' },
          { key: 'ACTIONED', label: 'Actioned' },
          { key: 'DISMISSED', label: 'Dismissed' },
        ]}
      />
      <Toolbar>
        <FilterSelect
          className="sm:w-56"
          label="Type"
          value={f.targetType}
          onChange={(targetType) => setF({ targetType })}
          options={[
            { value: 'PRODUCT', label: 'Listings' },
            { value: 'REVIEW', label: 'Reviews' },
            { value: 'VENDOR', label: 'Vendors' },
          ]}
        />
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <EmptyState title={f.status === 'OPEN' ? 'No open reports' : 'Nothing here'} />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Badge tone="danger">{humanize(r.reason)}</Badge>
                <Badge>{humanize(r.targetType)}</Badge>
                {r.reportsOnTarget > 1 && (
                  <Badge tone="warning">{r.reportsOnTarget} reports on this</Badge>
                )}
                <StatusBadge value={r.status} />
                <span className="text-xs text-slate-500">
                  {r.reporter.name} ({humanize(r.reporter.kind)}) · {ago(r.createdAt)}
                </span>
              </div>
              <TargetSummary r={r} />
              {r.details && (
                <p className="mt-2 whitespace-pre-line break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-700">
                  “{r.details}”
                </p>
              )}
              {r.status !== 'OPEN' ? (
                <p className="mt-2 text-sm text-slate-600">
                  {humanize(r.action ?? 'dismiss')}: {r.resolutionNote} · {dateTime(r.handledAt)}
                </p>
              ) : (
                can('trust:approve') && (
                  <div className="mt-3">
                    <Btn
                      size="sm"
                      tone="primary"
                      onClick={() => {
                        setAction(ACTIONS[r.targetType][0].value);
                        setHandling(r);
                      }}
                    >
                      Decide
                    </Btn>
                  </div>
                )
              )}
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={Boolean(handling)}
        title="Decide on this report"
        confirmLabel="Save decision"
        reasonLabel="Note (saved on the report and in the audit log)"
        canConfirm={Boolean(action)}
        onClose={() => setHandling(null)}
        onConfirm={async (note) => {
          if (!handling) return;
          await apiFetch(`/admin/reports/${handling.id}/action`, {
            method: 'POST',
            body: { action, note },
          });
          await reload();
        }}
      >
        {handling && (
          <ListSelect
            label="Action"
            value={action}
            onChange={setAction}
            options={ACTIONS[handling.targetType]}
          />
        )}
      </ReasonDialog>
    </div>
  );
}
