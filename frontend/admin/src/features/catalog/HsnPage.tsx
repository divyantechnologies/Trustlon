'use client';

import { useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  SearchInput,
  Toolbar,
  useAction,
} from '@/components/ui';
import { Dialog, ListSelect, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch, qs } from '@/lib/http';
import { date, shiftDate, todayIst } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface Version {
  id: string;
  description: string;
  gstRatePercent: number;
  effectiveFrom: string;
}

interface HsnItem {
  code: string;
  description: string;
  current: Version | null;
  upcoming: Version[];
  history: Version[];
}

const RATES = [0, 5, 18, 40];

/** HSN master (5.3): GST rates versioned by effective date; past invoices keep their rate. */
export function HsnPage() {
  const { can } = useAuth();
  const run = useAction();
  const [q, setQ] = useState('');
  const { data, error, reload } = useApi<{ items: HsnItem[] }>(`/admin/hsn${qs({ q })}`);
  const [form, setForm] = useState<{
    code: string;
    description: string;
    rate: string;
    from: string;
    existing: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const add = (item?: HsnItem) => {
    setMessage(null);
    setForm(
      item
        ? {
            code: item.code,
            description: item.description,
            rate: String(item.current?.gstRatePercent ?? 18),
            from: shiftDate(todayIst(), 1),
            existing: true,
          }
        : { code: '', description: '', rate: '18', from: todayIst(), existing: false },
    );
  };

  return (
    <div>
      <PageHeader
        title="HSN and GST rates"
        description="A rate change is added with a future start date. Orders and invoices before that date keep the rate they had."
        actions={
          can('catalog:create') && (
            <Btn tone="primary" onClick={() => add()}>
              Add HSN code
            </Btn>
          )
        }
      />
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="HSN code or description" />
      </Toolbar>
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <EmptyState title="No HSN codes" body="Add the codes your categories use." />
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {data.items.map((item) => (
            <Card key={item.code}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-base font-semibold text-navy">{item.code}</p>
                  <p className="text-sm text-slate-600">{item.description}</p>
                </div>
                <div className="text-end">
                  <p className="text-xl font-semibold text-navy">
                    {item.current ? `${item.current.gstRatePercent}%` : '—'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {item.current
                      ? `since ${date(item.current.effectiveFrom)}`
                      : 'not in effect yet'}
                  </p>
                </div>
              </div>
              {item.upcoming.map((u) => (
                <div
                  key={u.id}
                  className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800"
                >
                  <span>
                    <Badge tone="warning">Scheduled</Badge> {u.gstRatePercent}% from{' '}
                    {date(u.effectiveFrom)}
                  </span>
                  {can('catalog:edit') && (
                    <Btn
                      size="sm"
                      tone="ghost"
                      onClick={async () => {
                        if (!window.confirm('Withdraw this scheduled rate?')) return;
                        const done = await run(
                          () => apiFetch(`/admin/hsn/${u.id}`, { method: 'DELETE' }),
                          'Scheduled rate withdrawn',
                        );
                        if (done !== undefined) void reload();
                      }}
                    >
                      Withdraw
                    </Btn>
                  )}
                </div>
              ))}
              {item.history.length > 0 && (
                <p className="mt-2 text-xs text-slate-500">
                  Earlier:{' '}
                  {item.history
                    .map((h) => `${h.gstRatePercent}% from ${date(h.effectiveFrom)}`)
                    .join(' · ')}
                </p>
              )}
              {can('catalog:create') && (
                <div className="mt-3">
                  <Btn size="sm" onClick={() => add(item)}>
                    Schedule a rate change
                  </Btn>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
      <Dialog
        open={form !== null}
        title={form?.existing ? `New rate for HSN ${form.code}` : 'Add HSN code'}
        onClose={() => !saving && setForm(null)}
      >
        {form && (
          <form
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              setMessage(null);
              try {
                await apiFetch('/admin/hsn', {
                  method: 'POST',
                  body: {
                    code: form.code,
                    description: form.description,
                    gstRatePercent: Number(form.rate),
                    effectiveFrom: form.from,
                  },
                });
                setForm(null);
                void reload();
              } catch (err) {
                setMessage(err instanceof Error ? err.message : 'Could not save');
              } finally {
                setSaving(false);
              }
            }}
          >
            {message && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>
            )}
            <TextField
              label="HSN code"
              inputMode="numeric"
              disabled={form.existing}
              value={form.code}
              maxLength={8}
              onChange={(e) => setForm({ ...form, code: e.target.value.replace(/\D/g, '') })}
              hint="4, 6 or 8 digits"
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ListSelect
                label="GST rate"
                value={form.rate}
                onChange={(rate) => setForm({ ...form, rate })}
                options={RATES.map((r) => ({ value: String(r), label: `${r}%` }))}
              />
              <TextField
                label="Effective from"
                type="date"
                min={form.existing ? shiftDate(todayIst(), 1) : undefined}
                value={form.from}
                onChange={(e) => setForm({ ...form, from: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Btn onClick={() => setForm(null)}>Cancel</Btn>
              <Btn
                type="submit"
                tone="primary"
                loading={saving}
                disabled={
                  !/^\d{4}(\d{2}){0,2}$/.test(form.code) || form.description.trim().length < 3
                }
              >
                Save
              </Btn>
            </div>
          </form>
        )}
      </Dialog>
    </div>
  );
}
