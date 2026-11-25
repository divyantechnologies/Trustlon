'use client';

import { useEffect, useState } from 'react';
import { Badge, Btn, Card, ErrorState, Loading, PageHeader, useAction } from '@/components/ui';
import { ListSelect } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { date, humanize } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface RolesResponse {
  modules: Array<{ module: string; actions: string[] }>;
  actions: string[];
  roles: Array<{
    role: string;
    editable: boolean;
    panels: string[];
    members: number;
    permissions: string[];
    customised: boolean;
    updatedAt: string | null;
  }>;
}

const MODULE_NAMES: Record<string, string> = {
  dashboard: 'Dashboard',
  vendors: 'Vendors and KYC',
  catalog: 'Categories, attributes, HSN',
  products: 'Product moderation',
  orders: 'Orders',
  customers: 'Customers',
  marketing: 'Marketing',
  trust: 'Trust and safety',
  settings: 'Settings',
  staff: 'Staff and roles',
  audit: 'Audit log',
};

/** Roles (5.10 RoleEditor): which modules and actions each staff role can use. */
export function RolesPage() {
  const { can } = useAuth();
  const run = useAction();
  const { data, error, reload, setData } = useApi<RolesResponse>('/admin/roles');
  const [role, setRole] = useState('MARKETING');
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const current = data?.roles.find((r) => r.role === role);

  useEffect(() => {
    if (current) setDraft(current.permissions);
  }, [current]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data || !current) return <Loading />;

  const editable = current.editable && can('staff:edit');
  const dirty =
    JSON.stringify([...draft].sort()) !== JSON.stringify([...current.permissions].sort());
  const toggle = (perm: string) =>
    setDraft((d) => (d.includes(perm) ? d.filter((p) => p !== perm) : [...d, perm]));

  return (
    <div>
      <PageHeader
        title="Roles and permissions"
        description="Choose what each role can see and do. Super Admin always has everything. Changes apply at once and are written to the audit log."
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,20rem)_1fr] sm:items-end">
        <ListSelect
          label="Role"
          value={role}
          onChange={setRole}
          options={data.roles.map((r) => ({
            value: r.role,
            label: humanize(r.role),
            detail: `${r.members} ${r.members === 1 ? 'person' : 'people'}`,
          }))}
        />
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
          <span>Panels: {current.panels.map(humanize).join(', ') || 'none'}</span>
          {current.customised ? (
            <Badge tone="info">Customised {current.updatedAt ? date(current.updatedAt) : ''}</Badge>
          ) : (
            <Badge>Default</Badge>
          )}
        </div>
      </div>
      <Card padded={false}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <caption className="sr-only">Permissions for {humanize(role)}</caption>
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th scope="col" className="px-4 py-3 text-start font-semibold">
                  Module
                </th>
                {data.actions.map((a) => (
                  <th key={a} scope="col" className="px-3 py-3 text-center font-semibold">
                    {humanize(a)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.modules.map((m) => (
                <tr key={m.module}>
                  <th scope="row" className="px-4 py-2.5 text-start font-medium text-navy">
                    {MODULE_NAMES[m.module] ?? humanize(m.module)}
                  </th>
                  {data.actions.map((a) => {
                    const perm = `${m.module}:${a}`;
                    if (!m.actions.includes(a)) {
                      return (
                        <td key={a} className="px-3 py-2.5 text-center text-slate-300">
                          —
                        </td>
                      );
                    }
                    const on = draft.includes(perm);
                    return (
                      <td key={a} className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!editable}
                          onChange={() => toggle(perm)}
                          aria-label={`${humanize(role)}: ${humanize(a)} ${MODULE_NAMES[m.module] ?? m.module}`}
                          className={cn(
                            'h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal disabled:cursor-not-allowed',
                          )}
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      {editable && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn
            tone="primary"
            disabled={!dirty}
            loading={saving}
            onClick={async () => {
              setSaving(true);
              const result = await run(
                () =>
                  apiFetch<RolesResponse>(`/admin/roles/${role}`, {
                    method: 'PATCH',
                    body: { permissions: draft },
                  }),
                'Permissions saved',
              );
              setSaving(false);
              if (result) setData(result);
            }}
          >
            Save permissions
          </Btn>
          <Btn disabled={!dirty} onClick={() => setDraft(current.permissions)}>
            Undo
          </Btn>
          {current.customised && (
            <Btn
              tone="ghost"
              onClick={async () => {
                if (!window.confirm(`Put ${humanize(role)} back to the default permissions?`))
                  return;
                const result = await run(
                  () => apiFetch<RolesResponse>(`/admin/roles/${role}/reset`, { method: 'POST' }),
                  'Defaults restored',
                );
                if (result) setData(result);
              }}
            >
              Restore defaults
            </Btn>
          )}
        </div>
      )}
      {!current.editable && (
        <p className="mt-4 text-sm text-slate-500">Super Admin permissions can’t be changed.</p>
      )}
    </div>
  );
}
