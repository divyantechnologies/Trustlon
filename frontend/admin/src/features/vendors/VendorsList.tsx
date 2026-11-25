'use client';

import {
  Btn,
  DataTable,
  ErrorState,
  FilterSelect,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  Toolbar,
  Badge,
  useAction,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-provider';
import { apiDownload, qs } from '@/lib/http';
import { date, moneyWhole } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';
import type { Page, VendorRow } from './types';

/** All vendors (5.2 VendorTable). */
export function VendorsList() {
  const { can } = useAuth();
  const run = useAction();
  const [filters, setFilters] = useQueryState({
    q: '',
    status: '',
    kyc: '',
    underReview: '',
    sort: '',
    page: '1',
  });
  const query = qs({ ...filters, pageSize: 25 });
  const { data, error, loading, reload } = useApi<Page<VendorRow>>(`/admin/vendors${query}`);

  return (
    <div>
      <PageHeader
        title="Vendors"
        description="Approve, monitor and control sellers. Suspended vendors and their products disappear from the store at once."
        actions={
          can('vendors:export') && (
            <Btn
              size="sm"
              onClick={() =>
                void run(() =>
                  apiDownload(`/admin/vendors${qs({ ...filters, format: 'csv' })}`, 'vendors.csv'),
                )
              }
            >
              Export CSV
            </Btn>
          )
        }
      />
      <Toolbar>
        <SearchInput
          value={filters.q}
          onChange={(q) => setFilters({ q, page: '1' })}
          placeholder="Name, GSTIN or email"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            label="Status"
            value={filters.status}
            onChange={(status) => setFilters({ status, page: '1' })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'PENDING', label: 'Pending' },
              { value: 'SUSPENDED', label: 'Suspended' },
            ]}
          />
          <FilterSelect
            label="KYC"
            value={filters.kyc}
            onChange={(kyc) => setFilters({ kyc, page: '1' })}
            options={[
              { value: 'SUBMITTED', label: 'Submitted' },
              { value: 'MORE_INFO_REQUIRED', label: 'More info needed' },
              { value: 'APPROVED', label: 'Approved' },
              { value: 'REJECTED', label: 'Rejected' },
            ]}
          />
          <FilterSelect
            label="Review"
            value={filters.underReview}
            onChange={(underReview) => setFilters({ underReview, page: '1' })}
            options={[{ value: 'true', label: 'Under review' }]}
          />
          <FilterSelect
            label="Sort"
            value={filters.sort}
            onChange={(sort) => setFilters({ sort })}
            options={[
              { value: 'name', label: 'Name' },
              { value: 'trust', label: 'Trust Score' },
              { value: 'gmv', label: 'GMV (this page)' },
            ]}
          />
        </div>
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={loading ? 'opacity-60' : ''}>
          <DataTable
            caption="Vendors"
            rows={data.items}
            rowKey={(v) => v.id}
            rowHref={(v) => `/vendors/${v.id}`}
            columns={[
              {
                key: 'name',
                header: 'Vendor',
                primary: true,
                cell: (v) => (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {v.name}
                    {v.isVerified && <Badge tone="success">Verified</Badge>}
                    {v.isPlatformOwned && <Badge tone="navy">Own brand</Badge>}
                    {v.underReview && <Badge tone="warning">Under review</Badge>}
                  </span>
                ),
              },
              {
                key: 'gstin',
                header: 'GSTIN',
                cell: (v) => <span className="font-mono text-xs">{v.gstin ?? '—'}</span>,
              },
              {
                key: 'plan',
                header: 'Plan',
                cell: (v) => v.plan.charAt(0) + v.plan.slice(1).toLowerCase(),
                hideOnMobile: true,
              },
              { key: 'status', header: 'Status', cell: (v) => <StatusBadge value={v.status} /> },
              { key: 'kyc', header: 'KYC', cell: (v) => <StatusBadge value={v.kycStatus} /> },
              {
                key: 'trust',
                header: 'Trust Score',
                align: 'end',
                cell: (v) => <span className="tabular-nums">{v.trustScore}</span>,
              },
              {
                key: 'gmv',
                header: 'GMV',
                align: 'end',
                cell: (v) => <span className="tabular-nums">{moneyWhole(v.gmvPaise)}</span>,
              },
              {
                key: 'joined',
                header: 'Joined',
                cell: (v) => date(v.joinedAt),
                hideOnMobile: true,
              },
            ]}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPage={(page) => setFilters({ page: String(page) })}
          />
        </div>
      )}
    </div>
  );
}
