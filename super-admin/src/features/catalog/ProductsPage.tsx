'use client';

import Link from 'next/link';
import {
  Badge,
  Btn,
  DataTable,
  EmptyState,
  ErrorState,
  FilterSelect,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  StatusBadge,
  Tabs,
  Toolbar,
  useAction,
} from '@/components/ui';
import { focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { apiDownload, qs } from '@/lib/http';
import { ago, date, humanize, money } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';

interface Change {
  field: string;
  before: unknown;
  after: unknown;
}

interface ProductCard {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string;
  pricePaise: number;
  mrpPaise: number;
  status: string;
  authenticity: string;
  needsAuthenticityCheck: boolean;
  vendor: { id: string; displayName: string; trustScore: number; isVerified: boolean };
  category: { id: string; name: string };
}

interface QueueItem {
  submissionId: string | null;
  kind: 'NEW' | 'EDIT';
  submittedAt: string;
  changes: Change[];
  product: ProductCard;
}

interface ProductRow extends ProductCard {
  stock: number;
  salesCount: number;
  updatedAt: string;
}

interface Page<T> {
  items: T[];
  page: number;
  totalPages: number;
  total: number;
}

export const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  description: 'Description',
  brand: 'Brand',
  imageUrl: 'Main image',
  images: 'Images',
  pricePaise: 'Price',
  mrpPaise: 'MRP',
  categoryId: 'Category',
  hsnCode: 'HSN code',
  codAllowed: 'Cash on delivery',
  badge: 'Badge',
  isBundle: 'Combo product',
};

export function showValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (field.endsWith('Paise') && typeof value === 'number') return money(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  return String(value);
}

function Queue() {
  const { data, error, reload } = useApi<{
    items: QueueItem[];
    authenticityThresholdPaise: number;
  }>('/admin/products/moderation');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  if (!data.items.length)
    return (
      <EmptyState
        title="Nothing to review"
        body="New listings and edits that need approval appear here, oldest first."
      />
    );
  return (
    <ul className="space-y-3">
      {data.items.map((item) => (
        <li key={item.submissionId ?? item.product.id}>
          <Link
            href={`/catalog/products/${item.product.id}`}
            className={cn(
              'flex gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-teal sm:p-4',
              focusRing,
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={item.product.imageUrl}
              alt=""
              className="h-16 w-16 shrink-0 rounded-md bg-slate-100 object-cover sm:h-20 sm:w-20"
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge tone={item.kind === 'NEW' ? 'info' : 'warning'}>
                  {item.kind === 'NEW' ? 'New listing' : 'Edit'}
                </Badge>
                {item.product.needsAuthenticityCheck && (
                  <Badge tone="warning">High value: check authenticity</Badge>
                )}
                {item.product.authenticity === 'FLAGGED' && (
                  <Badge tone="warning">Authenticity check open</Badge>
                )}
                <span className="text-xs text-slate-500">submitted {ago(item.submittedAt)}</span>
              </div>
              <p className="mt-1 truncate font-medium text-navy">{item.product.name}</p>
              <p className="text-xs text-slate-500">
                {item.product.vendor.displayName} · {item.product.category.name} ·{' '}
                {money(item.product.pricePaise)}
              </p>
              {item.changes.length > 0 && (
                <p className="mt-1 truncate text-xs text-slate-600">
                  Changes:{' '}
                  {item.changes
                    .map(
                      (c) =>
                        `${FIELD_LABELS[c.field] ?? c.field} ${showValue(c.field, c.before)} → ${showValue(c.field, c.after)}`,
                    )
                    .join(' · ')}
                </p>
              )}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function AllProducts() {
  const { can } = useAuth();
  const run = useAction();
  const [f, setF] = useQueryState({
    tab: 'all',
    q: '',
    status: '',
    authenticity: '',
    vendorId: '',
    categoryId: '',
    page: '1',
  });
  const { tab: _tab, ...filters } = f;
  void _tab;
  const { data, error, loading, reload } = useApi<Page<ProductRow>>(
    `/admin/products${qs({ ...filters, pageSize: 25 })}`,
  );
  return (
    <div>
      <Toolbar>
        <SearchInput
          value={f.q}
          onChange={(q) => setF({ q, page: '1' })}
          placeholder="Product name or brand"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            label="Status"
            value={f.status}
            onChange={(status) => setF({ status, page: '1' })}
            options={[
              'LIVE',
              'PENDING_APPROVAL',
              'CHANGES_REQUESTED',
              'REJECTED',
              'INACTIVE',
              'DRAFT',
            ].map((s) => ({ value: s, label: humanize(s) }))}
          />
          <FilterSelect
            label="Authenticity"
            value={f.authenticity}
            onChange={(authenticity) => setF({ authenticity, page: '1' })}
            options={['FLAGGED', 'VERIFIED', 'FAILED'].map((s) => ({
              value: s,
              label: humanize(s),
            }))}
          />
          {can('products:export') && (
            <Btn
              size="sm"
              className="h-10"
              onClick={() =>
                void run(() =>
                  apiDownload(
                    `/admin/products${qs({ ...filters, format: 'csv' })}`,
                    'products.csv',
                  ),
                )
              }
            >
              Export CSV
            </Btn>
          )}
        </div>
      </Toolbar>
      {(f.vendorId || f.categoryId) && (
        <p className="mb-3 text-sm text-slate-600">
          Filtered by {f.vendorId ? 'vendor' : 'category'}.{' '}
          <button
            type="button"
            className="text-teal-600 hover:underline"
            onClick={() => setF({ vendorId: '', categoryId: '', page: '1' })}
          >
            Clear
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
            caption="Products"
            rows={data.items}
            rowKey={(p) => p.id}
            rowHref={(p) => `/catalog/products/${p.id}`}
            columns={[
              { key: 'name', header: 'Product', primary: true, cell: (p) => p.name },
              { key: 'vendor', header: 'Vendor', cell: (p) => p.vendor.displayName },
              {
                key: 'category',
                header: 'Category',
                cell: (p) => p.category.name,
                hideOnMobile: true,
              },
              {
                key: 'price',
                header: 'Price',
                align: 'end',
                cell: (p) => <span className="tabular-nums">{money(p.pricePaise)}</span>,
              },
              { key: 'stock', header: 'Stock', align: 'end', cell: (p) => p.stock },
              { key: 'status', header: 'Status', cell: (p) => <StatusBadge value={p.status} /> },
              {
                key: 'updated',
                header: 'Updated',
                cell: (p) => date(p.updatedAt),
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

/** Product moderation and all products (5.4). */
export function ProductsPage() {
  const [state, setState] = useQueryState({ tab: 'moderation' });
  return (
    <div>
      <PageHeader
        title="Products"
        description="Review new and edited listings before they go live, and find any product on the platform."
      />
      <Tabs
        label="Product views"
        value={state.tab === 'all' ? 'all' : 'moderation'}
        onChange={(tab) => setState({ tab })}
        tabs={[
          { key: 'moderation', label: 'Moderation queue' },
          { key: 'all', label: 'All products' },
        ]}
      />
      {state.tab === 'all' ? <AllProducts /> : <Queue />}
    </div>
  );
}
