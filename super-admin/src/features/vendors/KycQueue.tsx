'use client';

import { useState } from 'react';
import {
  Badge,
  DataTable,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import { ago, humanize } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface QueueItem {
  vendorId: string;
  name: string;
  legalName: string | null;
  status: string;
  submittedAt: string | null;
  documents: number;
  checks: { pan: string; gstin: string; pennyDrop: string };
  nameMatch: boolean | null;
}

function Check({ label, value }: { label: string; value: string }) {
  return (
    <StatusBadge
      value={value}
      label={`${label} ${value === 'PASSED' ? '✓' : value === 'FAILED' ? '✕' : '…'}`}
    />
  );
}

/** KYC queue (5.2 KycQueue): oldest first. */
export function KycQueue() {
  const [status, setStatus] = useState<'SUBMITTED' | 'MORE_INFO_REQUIRED'>('SUBMITTED');
  const { data, error, reload } = useApi<{ items: QueueItem[] }>(
    `/admin/kyc/queue?status=${status}`,
  );
  return (
    <div>
      <PageHeader
        title="KYC queue"
        description="Sellers who submitted identity, tax and bank details. Open one to see the documents next to the PAN, GSTIN and penny-drop results."
      />
      <Tabs
        label="KYC status"
        value={status}
        onChange={setStatus}
        tabs={[
          { key: 'SUBMITTED', label: 'Waiting for review' },
          { key: 'MORE_INFO_REQUIRED', label: 'Waiting for the vendor' },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <DataTable
          caption="KYC submissions"
          rows={data.items}
          rowKey={(i) => i.vendorId}
          rowHref={(i) => `/vendors/${i.vendorId}?tab=kyc`}
          empty={
            <EmptyState
              title={status === 'SUBMITTED' ? 'All caught up' : 'Nobody is waiting'}
              body="New submissions appear here."
            />
          }
          columns={[
            { key: 'name', header: 'Vendor', primary: true, cell: (i) => i.name },
            {
              key: 'legal',
              header: 'Legal name',
              cell: (i) => i.legalName ?? '—',
              hideOnMobile: true,
            },
            {
              key: 'checks',
              header: 'Checks',
              cell: (i) => (
                <span className="flex flex-wrap gap-1">
                  <Check label="PAN" value={i.checks.pan} />
                  <Check label="GSTIN" value={i.checks.gstin} />
                  <Check label="Bank" value={i.checks.pennyDrop} />
                </span>
              ),
            },
            {
              key: 'match',
              header: 'Name match',
              cell: (i) =>
                i.nameMatch === null ? (
                  '—'
                ) : i.nameMatch ? (
                  <Badge tone="success">Matches</Badge>
                ) : (
                  <Badge tone="danger">Mismatch</Badge>
                ),
            },
            { key: 'docs', header: 'Documents', align: 'end', cell: (i) => i.documents },
            {
              key: 'submitted',
              header: 'Submitted',
              cell: (i) => (i.submittedAt ? ago(i.submittedAt) : '—'),
            },
            {
              key: 'status',
              header: 'Status',
              cell: (i) => humanize(i.status),
              hideOnMobile: true,
            },
          ]}
        />
      )}
    </div>
  );
}
