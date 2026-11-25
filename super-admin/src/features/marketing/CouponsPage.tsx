'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Btn,
  DataTable,
  ErrorState,
  Loading,
  NumberInput,
  PageHeader,
  SearchInput,
  Toggle,
  Toolbar,
} from '@/components/ui';
import { Dialog, ListSelect, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, apiFetch } from '@/lib/http';
import { date, fromLocalInput, humanize, money, toLocalInput } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface Coupon {
  id: string;
  code: string;
  description: string;
  type: 'PERCENT' | 'FLAT' | 'FREE_DELIVERY';
  value: number;
  maxDiscountPaise: number | null;
  minOrderPaise: number;
  audience: 'ALL' | 'NEW_USERS' | 'PRIME_MEMBERS';
  categoryIds: string[];
  usageLimit: number | null;
  perUserLimit: number;
  usedCount: number;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  state: 'off' | 'ended' | 'scheduled' | 'used_up' | 'live';
}

interface Category {
  id: string;
  name: string;
  depth: number;
}

const STATE_TONE = {
  live: 'success',
  scheduled: 'info',
  off: 'neutral',
  ended: 'neutral',
  used_up: 'warning',
} as const;

function describe(c: Coupon) {
  if (c.type === 'PERCENT')
    return `${c.value / 100}% off${c.maxDiscountPaise ? ` up to ${money(c.maxDiscountPaise)}` : ''}`;
  if (c.type === 'FLAT') return `${money(c.value)} off`;
  return 'Free delivery';
}

interface Form {
  code: string;
  description: string;
  type: Coupon['type'];
  percent: number | null;
  flatRupees: number | null;
  maxDiscountRupees: number | null;
  minOrderRupees: number | null;
  audience: Coupon['audience'];
  categoryIds: string[];
  usageLimit: number | null;
  perUserLimit: number | null;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
}

const blank = (): Form => ({
  code: '',
  description: '',
  type: 'PERCENT',
  percent: 10,
  flatRupees: null,
  maxDiscountRupees: 200,
  minOrderRupees: 499,
  audience: 'ALL',
  categoryIds: [],
  usageLimit: null,
  perUserLimit: 1,
  startsAt: new Date().toISOString(),
  endsAt: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  isActive: true,
});

/** Platform coupons (5.7 PlatformCoupons): Trustlon-funded, never reduce the vendor's invoice. */
export function CouponsPage() {
  const { can } = useAuth();
  const { data, error, reload } = useApi<{ items: Coupon[] }>('/admin/coupons');
  const { data: cats } = useApi<{ items: Category[] }>('/admin/categories');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Coupon | 'new' | null>(null);
  const [form, setForm] = useState<Form>(blank());
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const categoryName = useMemo(
    () => new Map((cats?.items ?? []).map((c) => [c.id, c.name])),
    [cats],
  );

  useEffect(() => {
    if (!editing) return;
    setErr(null);
    if (editing === 'new') return setForm(blank());
    setForm({
      code: editing.code,
      description: editing.description,
      type: editing.type,
      percent: editing.type === 'PERCENT' ? editing.value / 100 : null,
      flatRupees: editing.type === 'FLAT' ? editing.value / 100 : null,
      maxDiscountRupees: editing.maxDiscountPaise === null ? null : editing.maxDiscountPaise / 100,
      minOrderRupees: editing.minOrderPaise / 100,
      audience: editing.audience,
      categoryIds: editing.categoryIds,
      usageLimit: editing.usageLimit,
      perUserLimit: editing.perUserLimit,
      startsAt: editing.startsAt,
      endsAt: editing.endsAt,
      isActive: editing.isActive,
    });
  }, [editing]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const rows = data.items.filter(
    (c) => !q || `${c.code} ${c.description}`.toLowerCase().includes(q.toLowerCase()),
  );
  const set = <K extends keyof Form>(key: K, value: Form[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const code = form.code.trim().toUpperCase();
    if (editing === 'new' && !/^[A-Z0-9]{3,20}$/.test(code))
      return setErr({ field: 'code', message: 'Use 3 to 20 capital letters and numbers' });
    if (form.type === 'PERCENT' && !(form.percent && form.percent >= 1 && form.percent <= 90))
      return setErr({ field: 'percent', message: 'Use 1 to 90%' });
    if (form.type === 'FLAT' && !(form.flatRupees && form.flatRupees >= 1))
      return setErr({ field: 'flat', message: 'Enter the amount off' });
    if (!form.startsAt || !form.endsAt || new Date(form.endsAt) <= new Date(form.startsAt))
      return setErr({ field: 'endsAt', message: 'End must be after start' });
    const value =
      form.type === 'PERCENT'
        ? Math.round((form.percent ?? 0) * 100)
        : form.type === 'FLAT'
          ? Math.round((form.flatRupees ?? 0) * 100)
          : 0;
    const body = {
      ...(editing === 'new' ? { code, type: form.type } : {}),
      description: form.description.trim() || undefined,
      value,
      maxDiscountPaise:
        form.type === 'PERCENT' && form.maxDiscountRupees
          ? Math.round(form.maxDiscountRupees * 100)
          : null,
      minOrderPaise: Math.round((form.minOrderRupees ?? 0) * 100),
      audience: form.audience,
      categoryIds: form.categoryIds,
      usageLimit: form.usageLimit || null,
      perUserLimit: form.perUserLimit ?? 1,
      startsAt: form.startsAt,
      endsAt: form.endsAt,
      isActive: form.isActive,
    };
    setSaving(true);
    setErr(null);
    try {
      await apiFetch(
        editing === 'new' ? '/admin/coupons' : `/admin/coupons/${(editing as Coupon).id}`,
        { method: editing === 'new' ? 'POST' : 'PATCH', body },
      );
      setEditing(null);
      await reload();
    } catch (e) {
      setErr({
        field: e instanceof ApiError ? e.field : undefined,
        message: e instanceof Error ? e.message : 'Couldn’t save',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Coupons"
        description="Trustlon-funded discount codes. They never reduce the vendor’s invoice value."
        actions={
          can('marketing:create') && (
            <Btn tone="primary" size="sm" onClick={() => setEditing('new')}>
              New coupon
            </Btn>
          )
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Code or description" />
      </Toolbar>
      <DataTable
        caption="Coupons"
        rows={rows}
        rowKey={(c) => c.id}
        columns={[
          {
            key: 'code',
            header: 'Code',
            primary: true,
            cell: (c) => (
              <span>
                <span className="font-mono font-semibold">{c.code}</span>
                <span className="block text-xs font-normal text-slate-500">{c.description}</span>
              </span>
            ),
          },
          {
            key: 'offer',
            header: 'Offer',
            cell: (c) =>
              `${describe(c)}${c.minOrderPaise ? ` · min ${money(c.minOrderPaise)}` : ''}`,
          },
          {
            key: 'who',
            header: 'For',
            cell: (c) =>
              `${humanize(c.audience)}${
                c.categoryIds.length
                  ? ` · ${c.categoryIds
                      .map((id) => categoryName.get(id) ?? '…')
                      .slice(0, 2)
                      .join(', ')}${c.categoryIds.length > 2 ? '…' : ''}`
                  : ''
              }`,
            hideOnMobile: true,
          },
          {
            key: 'used',
            header: 'Used',
            align: 'end',
            cell: (c) => `${c.usedCount}${c.usageLimit ? ` / ${c.usageLimit}` : ''}`,
          },
          { key: 'dates', header: 'Runs', cell: (c) => `${date(c.startsAt)} – ${date(c.endsAt)}` },
          {
            key: 'state',
            header: 'State',
            cell: (c) => <Badge tone={STATE_TONE[c.state]}>{humanize(c.state)}</Badge>,
          },
          {
            key: 'edit',
            header: '',
            cell: (c) =>
              can('marketing:edit') && (
                <Btn size="sm" onClick={() => setEditing(c)}>
                  Edit
                </Btn>
              ),
          },
        ]}
      />

      <Dialog
        open={Boolean(editing)}
        title={editing === 'new' ? 'New coupon' : `Edit ${form.code}`}
        onClose={() => !saving && setEditing(null)}
      >
        <form className="space-y-4" noValidate onSubmit={save}>
          {editing === 'new' && (
            <>
              <TextField
                label="Code"
                value={form.code}
                maxLength={20}
                onChange={(e) =>
                  set('code', e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
                }
                error={err?.field === 'code' ? err.message : undefined}
                hint="Customers type this at checkout."
              />
              <ListSelect
                label="Type"
                value={form.type}
                onChange={(v) => set('type', v as Form['type'])}
                options={[
                  { value: 'PERCENT', label: 'Percentage off' },
                  { value: 'FLAT', label: 'Flat amount off' },
                  { value: 'FREE_DELIVERY', label: 'Free delivery' },
                ]}
              />
            </>
          )}
          <TextField
            label="Description"
            value={form.description}
            maxLength={200}
            onChange={(e) => set('description', e.target.value)}
            hint="Shown to customers, e.g. “10% off your first order”."
          />
          {form.type === 'PERCENT' && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <NumberInput
                label="Discount"
                unit="%"
                value={form.percent}
                onChange={(v) => set('percent', v)}
                min={1}
                max={90}
                step={0.5}
                error={err?.field === 'percent' ? err.message : undefined}
              />
              <NumberInput
                label="Most it can take off"
                unit="₹"
                value={form.maxDiscountRupees}
                onChange={(v) => set('maxDiscountRupees', v)}
                min={1}
                hint="Leave empty for no cap."
              />
            </div>
          )}
          {form.type === 'FLAT' && (
            <NumberInput
              label="Amount off"
              unit="₹"
              value={form.flatRupees}
              onChange={(v) => set('flatRupees', v)}
              min={1}
              error={err?.field === 'flat' ? err.message : undefined}
            />
          )}
          <NumberInput
            label="Minimum order"
            unit="₹"
            value={form.minOrderRupees}
            onChange={(v) => set('minOrderRupees', v)}
            min={0}
          />
          <ListSelect
            label="Who can use it"
            value={form.audience}
            onChange={(v) => set('audience', v as Form['audience'])}
            options={[
              { value: 'ALL', label: 'Everyone' },
              { value: 'NEW_USERS', label: 'New customers', detail: 'first order' },
              { value: 'PRIME_MEMBERS', label: 'Prime members' },
            ]}
          />
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-navy">Categories</legend>
            <p className="mb-2 text-xs text-slate-500">None selected means every category.</p>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-2">
              {(cats?.items ?? []).map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-2 text-sm text-navy"
                  style={{ paddingInlineStart: `${(c.depth - 1) * 16}px` }}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-teal"
                    checked={form.categoryIds.includes(c.id)}
                    onChange={(e) =>
                      set(
                        'categoryIds',
                        e.target.checked
                          ? [...form.categoryIds, c.id]
                          : form.categoryIds.filter((x) => x !== c.id),
                      )
                    }
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NumberInput
              label="Total uses allowed"
              value={form.usageLimit}
              onChange={(v) => set('usageLimit', v)}
              min={1}
              hint="Empty for no limit."
            />
            <NumberInput
              label="Uses per customer"
              value={form.perUserLimit}
              onChange={(v) => set('perUserLimit', v)}
              min={1}
              max={100}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Starts"
              type="datetime-local"
              value={toLocalInput(form.startsAt)}
              onChange={(e) => set('startsAt', fromLocalInput(e.target.value))}
            />
            <TextField
              label="Ends"
              type="datetime-local"
              value={toLocalInput(form.endsAt)}
              onChange={(e) => set('endsAt', fromLocalInput(e.target.value))}
              error={err?.field === 'endsAt' ? err.message : undefined}
            />
          </div>
          <Toggle label="Active" checked={form.isActive} onChange={(v) => set('isActive', v)} />
          {err && !['code', 'percent', 'flat', 'endsAt'].includes(err.field ?? '') && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {err.message}
            </p>
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Btn onClick={() => setEditing(null)} disabled={saving}>
              Cancel
            </Btn>
            <Btn type="submit" tone="primary" loading={saving}>
              Save coupon
            </Btn>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
