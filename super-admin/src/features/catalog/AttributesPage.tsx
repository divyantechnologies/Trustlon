'use client';

import { useState } from 'react';
import {
  Badge,
  Btn,
  DataTable,
  ErrorState,
  Loading,
  PageHeader,
  TextArea,
  Toggle,
} from '@/components/ui';
import { Dialog, ListSelect, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { humanize } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface Attribute {
  id: string;
  code: string;
  name: string;
  type: string;
  unit: string | null;
  options: string[];
  isFilterable: boolean;
  isVariant: boolean;
  categoryIds: string[];
}

const TYPES = ['TEXT', 'NUMBER', 'SELECT', 'COLOR', 'SIZE', 'BOOLEAN'];
const blank = {
  name: '',
  code: '',
  type: 'SELECT',
  unit: '',
  options: '',
  isFilterable: true,
  isVariant: false,
};

/** Attribute sets (5.3 AttributeManager): size, colour, material… with filter and variant flags. */
export function AttributesPage() {
  const { can } = useAuth();
  const { data, error, reload } = useApi<{ items: Attribute[] }>('/admin/attributes');
  const [editing, setEditing] = useState<Attribute | 'new' | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;

  const open = (a: Attribute | 'new') => {
    setMessage(null);
    setEditing(a);
    setForm(
      a === 'new'
        ? blank
        : {
            name: a.name,
            code: a.code,
            type: a.type,
            unit: a.unit ?? '',
            options: a.options.join('\n'),
            isFilterable: a.isFilterable,
            isVariant: a.isVariant,
          },
    );
  };
  const withOptions = ['SELECT', 'COLOR', 'SIZE'].includes(form.type);

  return (
    <div>
      <PageHeader
        title="Attributes"
        description="Product details vendors fill in, such as size, colour and material. Filterable ones appear as filters on the store; variant ones split a product into options."
        actions={
          can('catalog:create') && (
            <Btn tone="primary" onClick={() => open('new')}>
              Add attribute
            </Btn>
          )
        }
      />
      <DataTable
        caption="Attributes"
        rows={data.items}
        rowKey={(a) => a.id}
        columns={[
          {
            key: 'name',
            header: 'Attribute',
            primary: true,
            cell: (a) =>
              can('catalog:edit') ? (
                <button
                  type="button"
                  onClick={() => open(a)}
                  className="text-start font-medium text-navy hover:text-teal-600"
                >
                  {a.name}
                </button>
              ) : (
                a.name
              ),
          },
          {
            key: 'code',
            header: 'Code',
            cell: (a) => <span className="font-mono text-xs">{a.code}</span>,
          },
          {
            key: 'type',
            header: 'Type',
            cell: (a) => humanize(a.type) + (a.unit ? ` (${a.unit})` : ''),
          },
          {
            key: 'options',
            header: 'Values',
            cell: (a) =>
              a.options.length
                ? a.options.slice(0, 5).join(', ') +
                  (a.options.length > 5 ? ` +${a.options.length - 5}` : '')
                : '—',
          },
          {
            key: 'flags',
            header: 'Used as',
            cell: (a) => (
              <span className="flex flex-wrap gap-1">
                {a.isFilterable && <Badge tone="info">Filter</Badge>}
                {a.isVariant && <Badge tone="success">Variant</Badge>}
              </span>
            ),
          },
          {
            key: 'categories',
            header: 'Categories',
            align: 'end',
            cell: (a) => a.categoryIds.length,
          },
        ]}
      />
      <Dialog
        open={editing !== null}
        title={editing === 'new' ? 'Add attribute' : 'Edit attribute'}
        onClose={() => !saving && setEditing(null)}
      >
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaving(true);
            setMessage(null);
            const body = {
              name: form.name,
              type: form.type,
              unit: form.unit,
              options: withOptions
                ? form.options
                    .split(/\n|,/)
                    .map((o) => o.trim())
                    .filter(Boolean)
                : [],
              isFilterable: form.isFilterable,
              isVariant: form.isVariant,
              ...(editing === 'new' && form.code ? { code: form.code } : {}),
            };
            try {
              if (editing === 'new') await apiFetch('/admin/attributes', { method: 'POST', body });
              else if (editing)
                await apiFetch(`/admin/attributes/${editing.id}`, { method: 'PATCH', body });
              setEditing(null);
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
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          {editing === 'new' && (
            <TextField
              label="Code"
              placeholder="made from the name"
              value={form.code}
              onChange={(e) =>
                setForm({ ...form, code: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })
              }
              hint="Used by the API and imports; can’t be changed later."
            />
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ListSelect
              label="Type"
              value={form.type}
              onChange={(type) => setForm({ ...form, type })}
              options={TYPES.map((t) => ({ value: t, label: humanize(t) }))}
            />
            <TextField
              label="Unit"
              placeholder="e.g. cm, g, hours"
              value={form.unit}
              maxLength={16}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </div>
          {withOptions && (
            <TextArea
              label="Values (one per line)"
              rows={5}
              value={form.options}
              onChange={(options) => setForm({ ...form, options })}
            />
          )}
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
            <Toggle
              label="Filterable"
              description="Shown as a filter on category and search pages"
              checked={form.isFilterable}
              onChange={(isFilterable) => setForm({ ...form, isFilterable })}
            />
            <Toggle
              label="Variant"
              description="Each value is a separate option with its own stock and price"
              checked={form.isVariant}
              onChange={(isVariant) => setForm({ ...form, isVariant })}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Btn onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn
              type="submit"
              tone="primary"
              loading={saving}
              disabled={form.name.trim().length < 2}
            >
              Save
            </Btn>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
