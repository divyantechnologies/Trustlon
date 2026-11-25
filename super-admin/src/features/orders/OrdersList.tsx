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
  useAction,
} from '@/components/ui';
import { TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { apiDownload, qs } from '@/lib/http';
import { dateTime, humanize, money } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';

interface OrderRow {
  id: string;
  orderNumber: string;
  customer: { id: string; fullName: string; mobile: string };
  stage: string;
  statuses: string[];
  paymentMethod: string;
  paymentStatus: string;
  totalPaise: number;
  vendors: Array<{ id: string; displayName: string }>;
  subOrders: number;
  placedAt: string;
}

const SUB_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PACKED',
  'SHIPPED',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'RETURN_REQUESTED',
  'RETURNED',
];

/** Order oversight (5.5): search by order or sub-order number, mobile, AWB or vendor. */
export function OrdersList() {
  const { can } = useAuth();
  const run = useAction();
  const [f, setF] = useQueryState({
    q: '',
    status: '',
    paymentStatus: '',
    paymentMethod: '',
    vendorId: '',
    customerId: '',
    from: '',
    to: '',
    page: '1',
  });
  const { data, error, loading, reload } = useApi<{
    items: OrderRow[];
    page: number;
    totalPages: number;
    total: number;
  }>(`/admin/orders${qs({ ...f, pageSize: 25 })}`);
  return (
    <div>
      <PageHeader
        title="Orders"
        description="Find any order on the platform and act on it: cancel, refund, change courier or add an internal note."
        actions={
          can('orders:export') && (
            <Btn
              size="sm"
              onClick={() =>
                void run(() =>
                  apiDownload(`/admin/orders${qs({ ...f, format: 'csv' })}`, 'orders.csv'),
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
          placeholder="Order no., sub-order no., mobile, AWB or vendor"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            label="Status"
            value={f.status}
            onChange={(status) => setF({ status, page: '1' })}
            options={SUB_STATUSES.map((s) => ({ value: s, label: humanize(s) }))}
          />
          <FilterSelect
            label="Payment"
            value={f.paymentStatus}
            onChange={(paymentStatus) => setF({ paymentStatus, page: '1' })}
            options={['PENDING', 'PAID', 'FAILED', 'PARTIALLY_REFUNDED', 'REFUNDED'].map((s) => ({
              value: s,
              label: humanize(s),
            }))}
          />
          <FilterSelect
            label="Method"
            value={f.paymentMethod}
            onChange={(paymentMethod) => setF({ paymentMethod, page: '1' })}
            options={['UPI', 'CARD', 'NETBANKING', 'WALLET', 'COD'].map((s) => ({
              value: s,
              label: s === 'COD' ? 'Cash on delivery' : humanize(s),
            }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="From"
            type="date"
            value={f.from}
            onChange={(e) => setF({ from: e.target.value, page: '1' })}
            className="h-10"
          />
          <TextField
            label="To"
            type="date"
            value={f.to}
            onChange={(e) => setF({ to: e.target.value, page: '1' })}
            className="h-10"
          />
        </div>
      </Toolbar>
      {(f.vendorId || f.customerId) && (
        <p className="mb-3 text-sm text-slate-600">
          Showing one {f.vendorId ? 'vendor' : 'customer'}’s orders.{' '}
          <button
            type="button"
            className="text-teal-600 hover:underline"
            onClick={() => setF({ vendorId: '', customerId: '', page: '1' })}
          >
            Show all
          </button>
        </p>
      )}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className={loading ? 'opacity-60' : ''}>
          <DataTable
            caption="Orders"
            rows={data.items}
            rowKey={(o) => o.id}
            rowHref={(o) => `/orders/${o.id}`}
            columns={[
              {
                key: 'number',
                header: 'Order',
                primary: true,
                cell: (o) => <span className="font-mono">{o.orderNumber}</span>,
              },
              { key: 'placed', header: 'Placed', cell: (o) => dateTime(o.placedAt) },
              {
                key: 'customer',
                header: 'Customer',
                cell: (o) => `${o.customer.fullName} · ${o.customer.mobile}`,
              },
              {
                key: 'vendors',
                header: 'Vendor',
                cell: (o) => o.vendors.map((v) => v.displayName).join(', '),
                hideOnMobile: true,
              },
              {
                key: 'status',
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
                key: 'payment',
                header: 'Payment',
                cell: (o) => (
                  <StatusBadge
                    value={o.paymentStatus}
                    label={`${o.paymentMethod === 'COD' ? 'COD' : humanize(o.paymentMethod)} · ${humanize(o.paymentStatus)}`}
                  />
                ),
              },
              {
                key: 'total',
                header: 'Amount',
                align: 'end',
                cell: (o) => <span className="tabular-nums">{money(o.totalPaise)}</span>,
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
