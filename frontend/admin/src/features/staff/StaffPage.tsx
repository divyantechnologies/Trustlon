'use client';

import { useState } from 'react';
import {
  Badge,
  Btn,
  DataTable,
  ErrorState,
  Loading,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  useAction,
} from '@/components/ui';
import { Checkbox, Dialog, ListSelect, MobileField, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, apiFetch } from '@/lib/http';
import { ago, humanize } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { isValidEmail, isValidName, toMobileE164 } from '@/lib/validation';

interface StaffRow {
  id: string;
  fullName: string;
  email: string;
  mobile: string;
  role: string;
  panels: string[];
  status: string;
  twoFactor: 'on' | 'not_set_up';
  recoveryCodesLeft: number;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const STAFF_ROLES = [
  { value: 'SUPER_ADMIN', label: 'Super Admin', detail: 'Everything' },
  { value: 'MARKETING', label: 'Marketing', detail: 'Catalog, marketing, trust' },
  { value: 'FINANCE', label: 'Finance', detail: 'Payouts, tax, exports' },
  { value: 'SUPPORT', label: 'Support', detail: 'Tickets, orders' },
  { value: 'LOGISTICS', label: 'Logistics', detail: 'Shipments' },
  { value: 'CA', label: 'Chartered accountant', detail: 'Tax reports' },
  { value: 'BRAND_TEAM', label: 'Brand team', detail: 'Own-brand catalog' },
] as const;

type Action = null | {
  kind: 'edit' | 'reset-2fa' | 'reset-password' | 'block' | 'unblock';
  staff: StaffRow;
};

function TemporaryPassword({
  value,
  onClose,
  title,
}: {
  value: string | null;
  onClose: () => void;
  title: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={Boolean(value)} title={title} onClose={onClose}>
      <div className="space-y-4 text-sm text-slate-600">
        <p>
          Share this temporary password privately. It’s shown only once; they must choose their own
          password and set up two-step sign-in at first sign-in.
        </p>
        <div className="flex items-center gap-2 rounded-lg bg-navy-50 p-3">
          <code className="min-w-0 flex-1 break-all font-mono text-base text-navy">{value}</code>
          <Btn
            size="sm"
            onClick={() => {
              void navigator.clipboard?.writeText(value ?? '').then(() => setCopied(true));
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </Btn>
        </div>
        <div className="flex justify-end">
          <Btn tone="primary" onClick={onClose}>
            Done
          </Btn>
        </div>
      </div>
    </Dialog>
  );
}

/** Staff (5.10 StaffTable): add people, change roles, reset passwords and two-step sign-in. */
export function StaffPage() {
  const { can, profile } = useAuth();
  const run = useAction();
  const { data, error, reload, setData } = useApi<{ items: StaffRow[] }>('/admin/staff');
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    country: 'IN',
    role: 'MARKETING',
    promoteExisting: false,
  });
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [password, setPassword] = useState<{ title: string; value: string } | null>(null);
  const [action, setAction] = useState<Action>(null);
  const [newRole, setNewRole] = useState('');

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const canCreate = can('staff:create');
  const canEdit = can('staff:edit');
  const notSetUp = data.items.filter((s) => s.twoFactor !== 'on' && s.status === 'ACTIVE').length;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const mobile = toMobileE164(form.mobile, form.country);
    if (!isValidName(form.fullName))
      return setFormError({ field: 'fullName', message: 'Enter their full name' });
    if (!isValidEmail(form.email))
      return setFormError({ field: 'email', message: 'Enter a valid work email' });
    if (!mobile) return setFormError({ field: 'mobile', message: 'Enter a valid mobile number' });
    setSaving(true);
    setFormError(null);
    try {
      const result = await apiFetch<{
        id: string;
        temporaryPassword: string | null;
        promoted: boolean;
      }>('/admin/staff', {
        method: 'POST',
        body: {
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          mobile,
          role: form.role,
          promoteExisting: form.promoteExisting,
        },
      });
      setAdding(false);
      setForm({
        fullName: '',
        email: '',
        mobile: '',
        country: 'IN',
        role: 'MARKETING',
        promoteExisting: false,
      });
      await reload();
      if (result.temporaryPassword)
        setPassword({ title: `${form.fullName} added`, value: result.temporaryPassword });
    } catch (err) {
      setFormError({
        field: err instanceof ApiError ? err.field : undefined,
        message:
          err instanceof Error && err.message ? err.message : 'That didn’t work. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  const patch = (staff: StaffRow, body: object) => async (reason: string) => {
    setData(
      await apiFetch<{ items: StaffRow[] }>(`/admin/staff/${staff.id}`, {
        method: 'PATCH',
        body: { ...body, reason },
      }),
    );
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Everyone who works in the Trustlon panels. Two-step sign-in is required for all staff."
        actions={
          canCreate && (
            <Btn tone="primary" size="sm" onClick={() => setAdding(true)}>
              Add staff member
            </Btn>
          )
        }
      />
      {notSetUp > 0 && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
        >
          {notSetUp} {notSetUp === 1 ? 'person hasn’t' : 'people haven’t'} set up two-step sign-in
          yet. They’ll be asked to at their next sign-in.
        </p>
      )}
      <DataTable
        caption="Staff"
        rows={data.items}
        rowKey={(s) => s.id}
        columns={[
          {
            key: 'name',
            header: 'Name',
            primary: true,
            cell: (s) => (
              <span>
                <span className="font-medium text-navy">{s.fullName}</span>
                {s.id === profile?.user.id && <Badge className="ms-1.5">You</Badge>}
                <span className="block break-all text-xs font-normal text-slate-500">
                  {s.email}
                </span>
              </span>
            ),
          },
          { key: 'role', header: 'Role', cell: (s) => humanize(s.role) },
          {
            key: 'panels',
            header: 'Panels',
            cell: (s) => s.panels.map(humanize).join(', '),
            hideOnMobile: true,
          },
          {
            key: '2fa',
            header: 'Two-step',
            cell: (s) =>
              s.twoFactor === 'on' ? (
                <Badge tone={s.recoveryCodesLeft < 3 ? 'warning' : 'success'}>
                  On · {s.recoveryCodesLeft} codes
                </Badge>
              ) : (
                <Badge tone="warning">Not set up</Badge>
              ),
          },
          { key: 'status', header: 'Status', cell: (s) => <StatusBadge value={s.status} /> },
          {
            key: 'last',
            header: 'Last sign-in',
            cell: (s) => (s.lastLoginAt ? ago(s.lastLoginAt) : 'Never'),
          },
          {
            key: 'actions',
            header: 'Actions',
            cell: (s) =>
              canEdit && s.id !== profile?.user.id ? (
                <span className="flex flex-wrap gap-1.5">
                  <Btn
                    size="sm"
                    onClick={() => {
                      setNewRole(s.role);
                      setAction({ kind: 'edit', staff: s });
                    }}
                  >
                    Role
                  </Btn>
                  <Btn size="sm" onClick={() => setAction({ kind: 'reset-password', staff: s })}>
                    Reset password
                  </Btn>
                  {s.twoFactor === 'on' && (
                    <Btn size="sm" onClick={() => setAction({ kind: 'reset-2fa', staff: s })}>
                      Reset two-step
                    </Btn>
                  )}
                  {s.status === 'ACTIVE' ? (
                    <Btn
                      size="sm"
                      tone="ghost"
                      className="text-red-600"
                      onClick={() => setAction({ kind: 'block', staff: s })}
                    >
                      Block
                    </Btn>
                  ) : (
                    <Btn
                      size="sm"
                      tone="ghost"
                      onClick={() => setAction({ kind: 'unblock', staff: s })}
                    >
                      Unblock
                    </Btn>
                  )}
                </span>
              ) : (
                <span className="text-xs text-slate-400">—</span>
              ),
          },
        ]}
      />

      <Dialog open={adding} title="Add staff member" onClose={() => !saving && setAdding(false)}>
        <form className="space-y-4" onSubmit={submit} noValidate>
          <TextField
            label="Full name"
            value={form.fullName}
            maxLength={100}
            onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            error={formError?.field === 'fullName' ? formError.message : undefined}
          />
          <TextField
            label="Work email"
            type="email"
            value={form.email}
            maxLength={254}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            error={formError?.field === 'email' ? formError.message : undefined}
          />
          <MobileField
            label="Mobile number"
            value={form.mobile}
            country={form.country}
            onCountryChange={(country) => setForm({ ...form, country })}
            onChange={(e) => setForm({ ...form, mobile: e.target.value })}
            error={formError?.field === 'mobile' ? formError.message : undefined}
          />
          <ListSelect
            label="Role"
            value={form.role}
            onChange={(role) => setForm({ ...form, role })}
            options={STAFF_ROLES.map((r) => ({ ...r }))}
          />
          <Checkbox
            checked={form.promoteExisting}
            onChange={(e) => setForm({ ...form, promoteExisting: e.target.checked })}
            label="If this email already has a customer account, give that account the staff role"
          />
          {formError && !['fullName', 'email', 'mobile'].includes(formError.field ?? '') && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Btn onClick={() => setAdding(false)} disabled={saving}>
              Cancel
            </Btn>
            <Btn type="submit" tone="primary" loading={saving}>
              Add and create password
            </Btn>
          </div>
        </form>
      </Dialog>

      <TemporaryPassword
        value={password?.value ?? null}
        title={password?.title ?? ''}
        onClose={() => setPassword(null)}
      />

      <ReasonDialog
        open={action?.kind === 'edit'}
        title={`Change role: ${action?.staff.fullName ?? ''}`}
        confirmLabel="Change role"
        canConfirm={Boolean(newRole) && newRole !== action?.staff.role}
        description="Choosing Customer removes their staff access."
        onClose={() => setAction(null)}
        onConfirm={async (reason) =>
          action && (await patch(action.staff, { role: newRole })(reason))
        }
      >
        <ListSelect
          label="Role"
          value={newRole}
          onChange={setNewRole}
          options={[
            ...STAFF_ROLES.map((r) => ({ ...r })),
            { value: 'CUSTOMER', label: 'Customer', detail: 'No staff access' },
          ]}
        />
      </ReasonDialog>

      <ReasonDialog
        open={action?.kind === 'block' || action?.kind === 'unblock'}
        tone={action?.kind === 'block' ? 'danger' : 'primary'}
        title={`${action?.kind === 'block' ? 'Block' : 'Unblock'} ${action?.staff.fullName ?? ''}`}
        confirmLabel={action?.kind === 'block' ? 'Block' : 'Unblock'}
        description={
          action?.kind === 'block' ? 'They’re signed out of every panel at once.' : undefined
        }
        onClose={() => setAction(null)}
        onConfirm={async (reason) =>
          action &&
          (await patch(action.staff, { status: action.kind === 'block' ? 'BLOCKED' : 'ACTIVE' })(
            reason,
          ))
        }
      />

      <ReasonDialog
        open={action?.kind === 'reset-2fa'}
        tone="danger"
        title={`Reset two-step sign-in for ${action?.staff.fullName ?? ''}`}
        confirmLabel="Reset"
        description="Use this when they’ve lost their phone. They’re signed out and must scan a new QR code at next sign-in."
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          if (!action) return;
          await apiFetch(`/admin/staff/${action.staff.id}/reset-2fa`, {
            method: 'POST',
            body: { reason },
          });
          await reload();
        }}
      />

      <ReasonDialog
        open={action?.kind === 'reset-password'}
        title={`Reset password for ${action?.staff.fullName ?? ''}`}
        confirmLabel="Create temporary password"
        description="They’re signed out and must choose a new password at next sign-in."
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          if (!action) return;
          const name = action.staff.fullName;
          const result = await run(() =>
            apiFetch<{ temporaryPassword: string }>(
              `/admin/staff/${action.staff.id}/reset-password`,
              { method: 'POST', body: { reason } },
            ),
          );
          if (result) {
            await reload();
            setPassword({ title: `New password for ${name}`, value: result.temporaryPassword });
          }
        }}
      />
    </div>
  );
}
