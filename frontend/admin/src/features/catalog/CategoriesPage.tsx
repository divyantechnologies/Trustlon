'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  EmptyState,
  ErrorState,
  Loading,
  NumberInput,
  PageHeader,
  Toggle,
  useAction,
} from '@/components/ui';
import { ImageField } from '@/components/ImageField';
import { Checkbox, Dialog, ListSelect, TextField, focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { useApi } from '@/lib/use-api';

export interface Category {
  id: string;
  name: string;
  nameHi: string | null;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  imageUrl: string | null;
  defaultHsn: string | null;
  commissionPercent: number | null;
  returnWindowDays: number;
  moderationRequired: boolean;
  codAllowed: boolean;
  isActive: boolean;
  products: number;
  attributes: number;
  children: number;
}

interface Attribute {
  id: string;
  name: string;
  code: string;
  type: string;
}

type Placement = 'before' | 'inside' | 'after';

/** Flattens the tree in display order. */
function ordered(items: Category[]) {
  const byParent = new Map<string | null, Category[]>();
  for (const c of items) byParent.set(c.parentId, [...(byParent.get(c.parentId) ?? []), c]);
  for (const list of byParent.values())
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const out: Category[] = [];
  const walk = (parent: string | null) => {
    for (const c of byParent.get(parent) ?? []) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(null);
  return { rows: out, byParent };
}

function subtreeHeight(id: string, byParent: Map<string | null, Category[]>): number {
  const kids = byParent.get(id) ?? [];
  return kids.length ? 1 + Math.max(...kids.map((k) => subtreeHeight(k.id, byParent))) : 0;
}

function isDescendant(id: string, of: string, items: Category[]): boolean {
  let node = items.find((c) => c.id === id);
  while (node?.parentId) {
    if (node.parentId === of) return true;
    node = items.find((c) => c.id === node!.parentId);
  }
  return false;
}

const empty = {
  name: '',
  nameHi: '',
  slug: '',
  description: '',
  parentId: null as string | null,
  imageUrl: null as string | null,
  defaultHsn: '',
  commissionPercent: null as number | null,
  returnWindowDays: 7 as number | null,
  moderationRequired: true,
  codAllowed: true,
  isActive: true,
};

/** Categories (5.3): drag-and-drop tree up to 4 levels, with commercial rules per category. */
export function CategoriesPage() {
  const { can } = useAuth();
  const run = useAction();
  const { data, error, reload, setData } = useApi<{ items: Category[]; maxDepth: number }>(
    '/admin/categories',
  );
  const { data: attrs } = useApi<{ items: Attribute[] }>('/admin/attributes');
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [form, setForm] = useState(empty);
  const [formError, setFormError] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ id: string; at: Placement } | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [attrFor, setAttrFor] = useState<Category | null>(null);
  const [attrRows, setAttrRows] = useState<Array<{ attributeId: string; isRequired: boolean }>>([]);
  const canEdit = can('catalog:edit');

  const tree = useMemo(() => (data ? ordered(data.items) : null), [data]);
  const maxDepth = data?.maxDepth ?? 4;

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data || !tree) return <Loading />;
  const items = data.items;

  const hidden = (c: Category): boolean => {
    let parent = c.parentId;
    while (parent) {
      if (collapsed.has(parent)) return true;
      parent = items.find((x) => x.id === parent)?.parentId ?? null;
    }
    return false;
  };

  /** Moves a category and saves the whole arrangement. */
  const move = async (id: string, target: Category, at: Placement) => {
    if (id === target.id || isDescendant(target.id, id, items)) return;
    const moving = items.find((c) => c.id === id)!;
    const newParent = at === 'inside' ? target.id : target.parentId;
    const parentDepth = newParent ? items.find((c) => c.id === newParent)!.depth : 0;
    if (parentDepth + 1 + subtreeHeight(id, tree.byParent) > maxDepth) {
      run(() => Promise.reject(new Error(`Categories can be at most ${maxDepth} levels deep`)));
      return;
    }
    const siblings = (tree.byParent.get(newParent) ?? []).filter((c) => c.id !== id);
    let index =
      at === 'inside'
        ? siblings.length
        : siblings.findIndex((c) => c.id === target.id) + (at === 'after' ? 1 : 0);
    if (index < 0) index = siblings.length;
    siblings.splice(index, 0, { ...moving, parentId: newParent });
    const changes = siblings.map((c, i) => ({ id: c.id, parentId: newParent, sortOrder: i }));
    const result = await run(
      () =>
        apiFetch<{ items: Category[]; maxDepth: number }>('/admin/categories/reorder', {
          method: 'POST',
          body: { items: changes },
        }),
      'Order saved',
    );
    if (result) setData(result);
  };

  const step = (c: Category, direction: 'up' | 'down' | 'in' | 'out') => {
    const siblings = tree.byParent.get(c.parentId) ?? [];
    const index = siblings.findIndex((s) => s.id === c.id);
    if (direction === 'up' && index > 0) return move(c.id, siblings[index - 1], 'before');
    if (direction === 'down' && index < siblings.length - 1)
      return move(c.id, siblings[index + 1], 'after');
    if (direction === 'in' && index > 0) return move(c.id, siblings[index - 1], 'inside');
    if (direction === 'out' && c.parentId)
      return move(c.id, items.find((x) => x.id === c.parentId)!, 'after');
  };

  const open = (c: Category | 'new', parentId: string | null = null) => {
    setFormError(null);
    setEditing(c);
    setForm(
      c === 'new'
        ? { ...empty, parentId }
        : {
            name: c.name,
            nameHi: c.nameHi ?? '',
            slug: c.slug,
            description: c.description ?? '',
            parentId: c.parentId,
            imageUrl: c.imageUrl,
            defaultHsn: c.defaultHsn ?? '',
            commissionPercent: c.commissionPercent,
            returnWindowDays: c.returnWindowDays,
            moderationRequired: c.moderationRequired,
            codAllowed: c.codAllowed,
            isActive: c.isActive,
          },
    );
  };

  const save = async () => {
    setSaving(true);
    setFormError(null);
    const body = {
      ...form,
      slug: form.slug || undefined,
      nameHi: form.nameHi,
      defaultHsn: form.defaultHsn || null,
      returnWindowDays: form.returnWindowDays ?? 7,
    };
    try {
      if (editing === 'new') await apiFetch('/admin/categories', { method: 'POST', body });
      else if (editing)
        await apiFetch(`/admin/categories/${editing.id}`, { method: 'PATCH', body });
      setEditing(null);
      await reload();
    } catch (err) {
      const e = err as Error & { field?: string };
      setFormError({ field: e.field, message: e.message || 'Could not save' });
    } finally {
      setSaving(false);
    }
  };

  const parentOptions = [
    { value: '', label: 'None (top level)' },
    ...tree.rows
      .filter(
        (c) =>
          c.depth < maxDepth &&
          (editing === 'new' ||
            !editing ||
            (c.id !== editing.id && !isDescendant(c.id, editing.id, items))),
      )
      .map((c) => ({ value: c.id, label: `${'— '.repeat(c.depth - 1)}${c.name}` })),
  ];

  return (
    <div>
      <PageHeader
        title="Categories"
        description={`Up to ${maxDepth} levels. Drag a category onto another to move it, or use the arrow buttons. Commission, return window, COD and moderation are set per category.`}
        actions={
          can('catalog:create') && (
            <Btn tone="primary" onClick={() => open('new')}>
              Add category
            </Btn>
          )
        }
      />
      {tree.rows.length === 0 ? (
        <EmptyState title="No categories yet" />
      ) : (
        <Card padded={false}>
          <ul role="tree" aria-label="Category tree" className="divide-y divide-slate-100">
            {tree.rows
              .filter((c) => !hidden(c))
              .map((c) => {
                const hasKids = (tree.byParent.get(c.id) ?? []).length > 0;
                const isDropTarget = drop?.id === c.id;
                return (
                  <li
                    key={c.id}
                    role="treeitem"
                    aria-level={c.depth}
                    aria-expanded={hasKids ? !collapsed.has(c.id) : undefined}
                    draggable={canEdit}
                    onDragStart={(e) => {
                      setDragId(c.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDrop(null);
                    }}
                    onDragOver={(e) => {
                      if (!dragId || dragId === c.id) return;
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const ratio = (e.clientY - rect.top) / rect.height;
                      setDrop({
                        id: c.id,
                        at: ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'inside',
                      });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId && drop) void move(dragId, c, drop.at);
                      setDragId(null);
                      setDrop(null);
                    }}
                    className={cn(
                      'relative flex flex-wrap items-center gap-2 py-2.5 pe-3',
                      dragId === c.id && 'opacity-40',
                      isDropTarget && drop?.at === 'inside' && 'bg-teal-50',
                      isDropTarget &&
                        drop?.at === 'before' &&
                        'shadow-[inset_0_2px_0_0_rgb(var(--tl-teal))]',
                      isDropTarget &&
                        drop?.at === 'after' &&
                        'shadow-[inset_0_-2px_0_0_rgb(var(--tl-teal))]',
                      !c.isActive && 'text-slate-400',
                    )}
                    style={{ paddingInlineStart: `${0.75 + (c.depth - 1) * 1.5}rem` }}
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      {canEdit && (
                        <span
                          aria-hidden
                          className="hidden cursor-grab select-none text-slate-400 md:inline"
                          title="Drag to move"
                        >
                          ⠿
                        </span>
                      )}
                      {hasKids ? (
                        <button
                          type="button"
                          aria-label={
                            collapsed.has(c.id) ? `Expand ${c.name}` : `Collapse ${c.name}`
                          }
                          onClick={() =>
                            setCollapsed((cur) => {
                              const next = new Set(cur);
                              if (next.has(c.id)) next.delete(c.id);
                              else next.add(c.id);
                              return next;
                            })
                          }
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100',
                            focusRing,
                          )}
                        >
                          {collapsed.has(c.id) ? '▸' : '▾'}
                        </button>
                      ) : (
                        <span className="w-6" />
                      )}
                      <button
                        type="button"
                        onClick={() => open(c)}
                        className={cn(
                          'min-w-0 truncate rounded text-start font-medium hover:text-teal-600',
                          c.isActive ? 'text-navy' : 'text-slate-400',
                          focusRing,
                        )}
                      >
                        {c.name}
                      </button>
                      {!c.isActive && <Badge>Off</Badge>}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      <span className="hidden sm:inline">{c.products} products</span>
                      <Badge tone="info">
                        {c.commissionPercent === null
                          ? 'Default commission'
                          : `${c.commissionPercent}%`}
                      </Badge>
                      <span className="hidden lg:inline">{c.returnWindowDays}-day returns</span>
                      {!c.codAllowed && <Badge tone="warning">No COD</Badge>}
                      {!c.moderationRequired && <Badge>No moderation</Badge>}
                      {c.defaultHsn && (
                        <span className="hidden font-mono lg:inline">HSN {c.defaultHsn}</span>
                      )}
                    </div>
                    {canEdit && (
                      <div className="flex items-center gap-0.5">
                        {(
                          [
                            ['up', '↑', 'Move up'],
                            ['down', '↓', 'Move down'],
                            ['in', '→', 'Move into the category above'],
                            ['out', '←', 'Move out one level'],
                          ] as const
                        ).map(([dir, icon, label]) => (
                          <button
                            key={dir}
                            type="button"
                            aria-label={`${label}: ${c.name}`}
                            title={label}
                            onClick={() => void step(c, dir)}
                            className={cn(
                              'flex h-8 w-8 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-navy',
                              focusRing,
                            )}
                          >
                            {icon}
                          </button>
                        ))}
                        <Btn
                          size="sm"
                          tone="ghost"
                          onClick={async () => {
                            setAttrFor(c);
                            const res = await run(() =>
                              apiFetch<{
                                items: Array<{ attributeId: string; isRequired: boolean }>;
                              }>(`/admin/categories/${c.id}/attributes`),
                            );
                            setAttrRows(
                              res?.items.map((i) => ({
                                attributeId: i.attributeId,
                                isRequired: i.isRequired,
                              })) ?? [],
                            );
                          }}
                        >
                          Attributes ({c.attributes})
                        </Btn>
                        {can('catalog:create') && c.depth < maxDepth && (
                          <Btn size="sm" tone="ghost" onClick={() => open('new', c.id)}>
                            + Sub
                          </Btn>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </Card>
      )}

      <Dialog
        open={editing !== null}
        title={editing === 'new' ? 'Add category' : `Edit ${editing ? editing.name : ''}`}
        onClose={() => !saving && setEditing(null)}
      >
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          {formError && !formError.field && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {formError.message}
            </p>
          )}
          <TextField
            label="Name"
            required
            value={form.name}
            maxLength={80}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={formError?.field === 'name' ? formError.message : undefined}
          />
          <TextField
            label="Name in Hindi"
            value={form.nameHi}
            maxLength={80}
            lang="hi"
            onChange={(e) => setForm({ ...form, nameHi: e.target.value })}
          />
          <TextField
            label="URL name"
            value={form.slug}
            placeholder="made from the name"
            onChange={(e) =>
              setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })
            }
            hint={
              form.slug
                ? `/c/${form.slug}`
                : 'Leave empty to make it from the name. Changing it breaks old links: add a redirect in SEO.'
            }
            error={formError?.field === 'slug' ? formError.message : undefined}
          />
          <ListSelect
            label="Parent"
            value={form.parentId ?? ''}
            onChange={(value) => setForm({ ...form, parentId: value || null })}
            options={parentOptions}
            error={formError?.field === 'parentId' ? formError.message : undefined}
          />
          <ImageField
            label="Image"
            kind="category"
            value={form.imageUrl}
            onChange={(imageUrl) => setForm({ ...form, imageUrl })}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField
              label="Default HSN"
              inputMode="numeric"
              maxLength={8}
              value={form.defaultHsn}
              onChange={(e) => setForm({ ...form, defaultHsn: e.target.value.replace(/\D/g, '') })}
              error={formError?.field === 'defaultHsn' ? formError.message : undefined}
            />
            <NumberInput
              label="Return window"
              unit="days"
              min={0}
              max={90}
              value={form.returnWindowDays}
              onChange={(returnWindowDays) => setForm({ ...form, returnWindowDays })}
            />
          </div>
          <NumberInput
            label="Commission"
            unit="% (empty = platform default)"
            min={0}
            max={50}
            step={0.1}
            value={form.commissionPercent}
            onChange={(commissionPercent) => setForm({ ...form, commissionPercent })}
            hint="A vendor’s own rate (set on the vendor page) overrides this."
          />
          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 px-3">
            <Toggle
              label="Moderation required"
              description="New and edited listings wait for approval"
              checked={form.moderationRequired}
              onChange={(moderationRequired) => setForm({ ...form, moderationRequired })}
            />
            <Toggle
              label="Cash on delivery allowed"
              checked={form.codAllowed}
              onChange={(codAllowed) => setForm({ ...form, codAllowed })}
            />
            <Toggle
              label="Shown on the store"
              checked={form.isActive}
              onChange={(isActive) => setForm({ ...form, isActive })}
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            {editing &&
            editing !== 'new' &&
            editing.products === 0 &&
            editing.children === 0 &&
            canEdit ? (
              <Btn
                tone="ghost"
                className="text-red-600"
                onClick={async () => {
                  if (!window.confirm(`Delete ${editing.name}? This can’t be undone.`)) return;
                  const done = await run(
                    () => apiFetch(`/admin/categories/${editing.id}`, { method: 'DELETE' }),
                    'Category deleted',
                  );
                  if (done !== undefined) {
                    setEditing(null);
                    void reload();
                  }
                }}
              >
                Delete
              </Btn>
            ) : (
              <span />
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row">
              <Btn onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Btn>
              <Btn
                type="submit"
                tone="primary"
                loading={saving}
                disabled={form.name.trim().length < 2}
              >
                Save
              </Btn>
            </div>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={attrFor !== null}
        title={`Attributes of ${attrFor?.name ?? ''}`}
        onClose={() => setAttrFor(null)}
      >
        <p className="mb-3 text-sm text-slate-600">
          Vendors fill these in when they list a product in this category. Manage the list in
          Catalog › Attributes.
        </p>
        <ul className="max-h-80 space-y-2 overflow-y-auto">
          {(attrs?.items ?? []).map((a) => {
            const row = attrRows.find((r) => r.attributeId === a.id);
            return (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2"
              >
                <Checkbox
                  label={`${a.name} (${a.type.toLowerCase()})`}
                  checked={Boolean(row)}
                  onChange={(e) =>
                    setAttrRows((cur) =>
                      e.target.checked
                        ? [...cur, { attributeId: a.id, isRequired: false }]
                        : cur.filter((r) => r.attributeId !== a.id),
                    )
                  }
                />
                {row && (
                  <Checkbox
                    label="Required"
                    checked={row.isRequired}
                    onChange={(e) =>
                      setAttrRows((cur) =>
                        cur.map((r) =>
                          r.attributeId === a.id ? { ...r, isRequired: e.target.checked } : r,
                        ),
                      )
                    }
                  />
                )}
              </li>
            );
          })}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <Btn onClick={() => setAttrFor(null)}>Cancel</Btn>
          <Btn
            tone="primary"
            onClick={async () => {
              if (!attrFor) return;
              const done = await run(
                () =>
                  apiFetch(`/admin/categories/${attrFor.id}/attributes`, {
                    method: 'PUT',
                    body: { items: attrRows.map((r, i) => ({ ...r, sortOrder: i })) },
                  }),
                'Attribute set saved',
              );
              if (done) {
                setAttrFor(null);
                void reload();
              }
            }}
          >
            Save
          </Btn>
        </div>
      </Dialog>
    </div>
  );
}
