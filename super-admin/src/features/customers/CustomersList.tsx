'use client';

import {
  Badge,
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
  useAction,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-provider';
import { apiDownload, qs } from '@/lib/http';
import { date, moneyWhole } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';

export interface CustomerRow {
  id: string;
  fullName: string;
  mobile: string;
  email: string;
  status: string;
  codDisabled: boolean;
  b2b: string | null;
  orders: number;
  lifetimeValuePaise: number;
  joinedAt: string;
  lastLoginAt: string | null;
}

/** Customers (5.6 CustomerTable). */
export function CustomersList() {
  const { can } = useAuth();
  const run = useAction();
  const [f, setF] = useQueryState({ q: '', status: '', b2b: '', codDisabled: '', page: '1' });
  const { data, error, loading, reload } = useApi<{
    items: CustomerRow[];
    page: number;
    totalPages: number;
    total: number;
  }>(`/admin/customers${qs({ ...f, pageSize: 25 })}`);
  return (
    <div>
      <PageHeader
        title="Customers"
        description="View customer accounts, block or unblock them, verify business (B2B) details and adjust wallets."
        actions={
          can('customers:export') && (
            <Btn
              size="sm"
              onClick={() =>
                void run(() =>
                  apiDownload(`/admin/customers${qs({ ...f, format: 'csv' })}`, 'customers.csv'),
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
          value={f.q}
          onChange={(q) => setF({ q, page: '1' })}
          placeholder="Name, mobile or email"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            label="Status"
            value={f.status}
            onChange={(status) => setF({ status, page: '1' })}
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'BLOCKED', label: 'Blocked' },
            ]}
          />
          <FilterSelect
            label="B2B"
            value={f.b2b}
            onChange={(b2b) => setF({ b2b, page: '1' })}
            options={[{ value: 'true', label: 'Business buyers' }]}
          />
          <FilterSelect
            label="COD"
            value={f.codDisabled}
            onChange={(codDisabled) => setF({ codDisabled, page: '1' })}
            options={[{ value: 'true', label: 'COD disabled' }]}
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
            caption="Customers"
            rows={data.items}
            rowKey={(c) => c.id}
            rowHref={(c) => `/customers/${c.id}`}
            columns={[
              {
                key: 'name',
                header: 'Customer',
                primary: true,
                cell: (c) => (
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {c.fullName}
                    {c.b2b && (
                      <Badge tone={c.b2b === 'VERIFIED' ? 'success' : 'warning'}>B2B</Badge>
                    )}
                    {c.codDisabled && <Badge tone="warning">No COD</Badge>}
                  </span>
                ),
              },
              { key: 'mobile', header: 'Mobile', cell: (c) => c.mobile },
              {
                key: 'email',
                header: 'Email',
                cell: (c) => <span className="break-all">{c.email}</span>,
                hideOnMobile: true,
              },
              {
                key: 'orders',
                header: 'Orders',
                align: 'end',
                cell: (c) => <span className="tabular-nums">{c.orders}</span>,
              },
              {
                key: 'ltv',
                header: 'Lifetime value',
                align: 'end',
                cell: (c) => (
                  <span className="tabular-nums">{moneyWhole(c.lifetimeValuePaise)}</span>
                ),
              },
              { key: 'status', header: 'Status', cell: (c) => <StatusBadge value={c.status} /> },
              {
                key: 'joined',
                header: 'Joined',
                cell: (c) => date(c.joinedAt),
                hideOnMobile: true,
              },
            ]}
          />
          <Pagination
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            onPage={(page) => setF({ page: String(page) })}
          />
        </div>
      )}
    </div>
  );
}
