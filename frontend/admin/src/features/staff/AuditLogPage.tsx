'use client';

import { useState } from 'react';
import {
  Btn,
  ErrorState,
  FilterSelect,
  Loading,
  PageHeader,
  Pagination,
  SearchInput,
  Toolbar,
  EmptyState,
  useAction,
} from '@/components/ui';
import { TextField, focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { apiDownload, qs } from '@/lib/http';
import { dateTime, humanize } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';

interface AuditRow {
  id: string;
  actorId: string | null;
  actorName: string | null;
  actorRole: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  summary: string | null;
  reason: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  createdAt: string;
}

interface AuditPage {
  items: AuditRow[];
  page: number;
  totalPages: number;
  total: number;
  filters: { actors: Array<{ id: string; name: string | null }>; entities: string[] };
}

/** Flat list of changed values, e.g. "status: ACTIVE → SUSPENDED". */
function diff(before: unknown, after: unknown, prefix = ''): string[] {
  const isObj = (v: unknown): v is Record<string, unknown> =>
    Boolean(v) && typeof v === 'object' && !Array.isArray(v);
  if (isObj(before) || isObj(after)) {
    const a = isObj(before) ? before : {};
    const b = isObj(after) ? after : {};
    return [...new Set([...Object.keys(a), ...Object.keys(b)])].flatMap((k) =>
      diff(a[k], b[k], prefix ? `${prefix}.${k}` : k),
    );
  }
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  const show = (v: unknown) =>
    v === undefined || v === null || v === '' ? '—' : Array.isArray(v) ? v.join(', ') : String(v);
  return [`${prefix ? `${prefix}: ` : ''}${show(before)} → ${show(after)}`];
}

const LINKS: Record<string, (id: string) => string> = {
  vendor: (id) => `/vendors/${id}`,
  order: (id) => `/orders/${id}`,
  customer: (id) => `/customers/${id}`,
  product: (id) => `/catalog/products/${id}`,
};

/** Audit log (5.10 AuditLogTable): every staff action, newest first. Insert-only. */
export function AuditLogPage() {
  const { can } = useAuth();
  const run = useAction();
  const [f, setF] = useQueryState({
    q: '',
    actorId: '',
    entity: '',
    entityId: '',
    action: '',
    from: '',
    to: '',
    page: '1',
  });
  const { data, error, loading, reload } = useApi<AuditPage>(
    `/admin/audit-log${qs({ ...f, pageSize: 50 })}`,
  );
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Audit log"
        description="Every action staff take: who, what, before and after, from which IP. Entries can’t be edited or deleted."
        actions={
          can('audit:export') && (
            <Btn
              size="sm"
              onClick={() =>
                void run(() =>
                  apiDownload(`/admin/audit-log${qs({ ...f, format: 'csv' })}`, 'audit-log.csv'),
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
          placeholder="Search summary, reason, staff or ID"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <FilterSelect
            label="Staff"
            value={f.actorId}
            onChange={(actorId) => setF({ actorId, page: '1' })}
            options={(data?.filters.actors ?? []).map((a) => ({
              value: a.id,
              label: a.name ?? 'Unknown',
            }))}
          />
          <FilterSelect
            label="Area"
            value={f.entity}
            onChange={(entity) => setF({ entity, entityId: '', page: '1' })}
            options={(data?.filters.entities ?? []).map((e) => ({ value: e, label: humanize(e) }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <TextField
            label="From"
            type="date"
            value={f.from}
            onChange={(e) => setF({ from: e.target.value, page: '1' })}
          />
          <TextField
            label="To"
            type="date"
            value={f.to}
            onChange={(e) => setF({ to: e.target.value, page: '1' })}
          />
        </div>
      </Toolbar>
      {f.entityId && (
        <p className="mb-3 text-sm text-slate-600">
          Showing one {humanize(f.entity || 'record').toLowerCase()}.{' '}
          <button
            type="button"
            className="text-teal-600 hover:underline"
            onClick={() => setF({ entityId: '', page: '1' })}
          >
            Show all
          </button>
        </p>
      )}
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <EmptyState title="No matching entries" />
      ) : (
        <div className={loading ? 'opacity-60' : ''}>
          <ol className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
            {data.items.map((row) => {
              const changes = diff(row.before, row.after);
              const expanded = open === row.id;
              const link =
                row.entityId && LINKS[row.entity] ? LINKS[row.entity](row.entityId) : null;
              return (
                <li key={row.id} className="p-4">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <p className="text-sm text-navy">
                        <span className="font-semibold">{row.actorName ?? 'System'}</span>
                        {row.actorRole && (
                          <span className="text-slate-500"> ({humanize(row.actorRole)})</span>
                        )}{' '}
                        · <code className="text-xs">{row.action}</code>
                      </p>
                      <p className="break-words text-sm text-slate-600">
                        {humanize(row.entity)}
                        {row.summary && (
                          <>
                            {': '}
                            {link ? (
                              <a href={link} className="text-teal-600 hover:underline">
                                {row.summary}
                              </a>
                            ) : (
                              row.summary
                            )}
                          </>
                        )}
                      </p>
                      {row.reason && (
                        <p className="mt-1 break-words text-sm text-slate-600">
                          Reason: “{row.reason}”
                        </p>
                      )}
                    </div>
                    <p className="shrink-0 text-xs text-slate-500">
                      {dateTime(row.createdAt)}
                      {row.ip && <span className="block">IP {row.ip}</span>}
                    </p>
                  </div>
                  {changes.length > 0 && (
                    <div className="mt-2">
                      <button
                        type="button"
                        aria-expanded={expanded}
                        onClick={() => setOpen(expanded ? null : row.id)}
                        className={cn(
                          'rounded text-xs font-semibold text-teal-600 hover:underline',
                          focusRing,
                        )}
                      >
                        {expanded
                          ? 'Hide changes'
                          : `Show ${changes.length} ${changes.length === 1 ? 'change' : 'changes'}`}
                      </button>
                      {expanded && (
                        <ul className="mt-2 space-y-1 rounded-lg bg-slate-50 p-3 font-mono text-xs text-navy">
                          {changes.slice(0, 60).map((c) => (
                            <li key={c} className="break-words">
                              {c}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
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
