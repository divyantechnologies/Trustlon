'use client';

import { useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  DataTable,
  ErrorState,
  Loading,
  PageHeader,
  SearchInput,
  Stat,
  Tabs,
  Toggle,
  Toolbar,
  useAction,
} from '@/components/ui';
import { ImageField } from '@/components/ImageField';
import { Dialog, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, apiFetch } from '@/lib/http';
import { count, date, humanize } from '@/lib/format';
import { useApi } from '@/lib/use-api';
import { TextArea } from '@/components/ui';

interface SeoItem {
  entity: 'HOME' | 'CATEGORY' | 'PAGE';
  entityKey: string;
  label: string;
  path: string;
  title: string | null;
  description: string | null;
  keywords: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
  updatedAt: string | null;
}

interface Redirect {
  id: string;
  fromPath: string;
  toPath: string;
  permanent: boolean;
  createdAt: string;
}

function SnippetPreview({ item }: { item: SeoItem }) {
  const store = (process.env.NEXT_PUBLIC_STOREFRONT_URL || 'https://trustlon.com').replace(
    /^https?:\/\//,
    '',
  );
  return (
    <div
      className="rounded-lg border border-slate-200 bg-white p-3"
      aria-label="Search result preview"
    >
      <p className="truncate text-xs text-slate-500">
        {store}
        {item.path}
      </p>
      <p className="truncate text-base text-[#1a0dab]">
        {item.title || `${item.label} | Trustlon`}
      </p>
      <p className="line-clamp-2 text-sm text-slate-600">
        {item.description || 'No description yet: search engines will pick text from the page.'}
      </p>
    </div>
  );
}

function MetaTags() {
  const { can } = useAuth();
  const { data, error, reload, setData } = useApi<{ items: SeoItem[] }>('/admin/seo');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<SeoItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const rows = data.items.filter(
    (i) => !q || `${i.label} ${i.path}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder="Category or page" />
      </Toolbar>
      <DataTable
        caption="Search settings"
        rows={rows}
        rowKey={(i) => `${i.entity}:${i.entityKey}`}
        columns={[
          {
            key: 'label',
            header: 'Page',
            primary: true,
            cell: (i) => (
              <span>
                {i.label}{' '}
                <span className="block font-mono text-xs font-normal text-slate-500">{i.path}</span>
              </span>
            ),
          },
          { key: 'type', header: 'Type', cell: (i) => humanize(i.entity) },
          {
            key: 'title',
            header: 'Search title',
            cell: (i) => i.title ?? <span className="text-slate-400">Default</span>,
            hideOnMobile: true,
          },
          {
            key: 'state',
            header: 'Search engines',
            cell: (i) =>
              i.noIndex ? (
                <Badge tone="warning">Hidden</Badge>
              ) : i.title || i.description ? (
                <Badge tone="success">Custom</Badge>
              ) : (
                <Badge>Default</Badge>
              ),
          },
          {
            key: 'edit',
            header: '',
            cell: (i) =>
              can('marketing:edit') && (
                <Btn
                  size="sm"
                  onClick={() => {
                    setErr(null);
                    setEditing({ ...i });
                  }}
                >
                  Edit
                </Btn>
              ),
          },
        ]}
      />
      <Dialog
        open={Boolean(editing)}
        title={`Search settings: ${editing?.label ?? ''}`}
        onClose={() => !saving && setEditing(null)}
      >
        {editing && (
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setErr(null);
              try {
                await apiFetch('/admin/seo', {
                  method: 'PUT',
                  body: {
                    entity: editing.entity,
                    entityKey: editing.entityKey,
                    title: editing.title?.trim() || null,
                    description: editing.description?.trim() || null,
                    keywords: editing.keywords?.trim() || null,
                    ogImageUrl: editing.ogImageUrl || null,
                    noIndex: editing.noIndex,
                  },
                });
                setData({
                  items: data.items.map((i) =>
                    i.entity === editing.entity && i.entityKey === editing.entityKey
                      ? { ...editing, updatedAt: new Date().toISOString() }
                      : i,
                  ),
                });
                setEditing(null);
              } catch (e) {
                setErr(e instanceof ApiError || e instanceof Error ? e.message : 'Couldn’t save');
              } finally {
                setSaving(false);
              }
            }}
          >
            <SnippetPreview item={editing} />
            <TextField
              label="Title"
              value={editing.title ?? ''}
              maxLength={70}
              hint={`${(editing.title ?? '').length}/70 · leave empty for the default`}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
            />
            <TextArea
              label="Description"
              value={editing.description ?? ''}
              maxLength={170}
              rows={3}
              hint={`${(editing.description ?? '').length}/170`}
              onChange={(v) => setEditing({ ...editing, description: v })}
            />
            <TextField
              label="Keywords (optional)"
              value={editing.keywords ?? ''}
              maxLength={255}
              onChange={(e) => setEditing({ ...editing, keywords: e.target.value })}
            />
            <ImageField
              label="Share image"
              kind="seo"
              value={editing.ogImageUrl}
              onChange={(url) => setEditing({ ...editing, ogImageUrl: url })}
              hint="1200 × 630, shown when the link is shared on WhatsApp or social media"
            />
            <Toggle
              label="Hide from search engines"
              description="Adds noindex and leaves it out of the sitemap."
              checked={editing.noIndex}
              onChange={(v) => setEditing({ ...editing, noIndex: v })}
            />
            {err && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {err}
              </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Btn onClick={() => setEditing(null)} disabled={saving}>
                Cancel
              </Btn>
              <Btn type="submit" tone="primary" loading={saving}>
                Save
              </Btn>
            </div>
          </form>
        )}
      </Dialog>
    </>
  );
}

function Redirects() {
  const { can } = useAuth();
  const run = useAction();
  const { data, error, reload } = useApi<{ items: Redirect[] }>('/admin/redirects');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [permanent, setPermanent] = useState(true);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const [saving, setSaving] = useState(false);
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="space-y-5">
      {can('marketing:edit') && (
        <Card
          title="Add a redirect"
          description="Send an old address to a new one, e.g. after renaming a category."
        >
          <form
            className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] md:items-end"
            onSubmit={async (event) => {
              event.preventDefault();
              setSaving(true);
              setErr(null);
              try {
                await apiFetch('/admin/redirects', {
                  method: 'POST',
                  body: { fromPath: from.trim(), toPath: to.trim(), permanent },
                });
                setFrom('');
                setTo('');
                await reload();
              } catch (e) {
                setErr({
                  field: e instanceof ApiError ? e.field : undefined,
                  message: e instanceof Error ? e.message : 'Couldn’t add',
                });
              } finally {
                setSaving(false);
              }
            }}
          >
            <TextField
              label="From"
              placeholder="/c/old-name"
              value={from}
              maxLength={300}
              onChange={(e) => setFrom(e.target.value)}
              error={err?.field === 'fromPath' ? err.message : undefined}
            />
            <TextField
              label="To"
              placeholder="/c/new-name"
              value={to}
              maxLength={500}
              onChange={(e) => setTo(e.target.value)}
              error={err?.field === 'toPath' ? err.message : undefined}
            />
            <Toggle label="Permanent" checked={permanent} onChange={setPermanent} />
            <Btn type="submit" tone="primary" loading={saving} disabled={!from || !to}>
              Add
            </Btn>
            {err && !err.field && (
              <p className="text-sm text-red-600 md:col-span-4">{err.message}</p>
            )}
          </form>
        </Card>
      )}
      <DataTable
        caption="Redirects"
        rows={data.items}
        rowKey={(r) => r.id}
        columns={[
          {
            key: 'from',
            header: 'From',
            primary: true,
            cell: (r) => <span className="break-all font-mono text-xs">{r.fromPath}</span>,
          },
          {
            key: 'to',
            header: 'To',
            cell: (r) => <span className="break-all font-mono text-xs">{r.toPath}</span>,
          },
          { key: 'type', header: 'Type', cell: (r) => (r.permanent ? 'Permanent' : 'Temporary') },
          { key: 'added', header: 'Added', cell: (r) => date(r.createdAt), hideOnMobile: true },
          {
            key: 'del',
            header: '',
            cell: (r) =>
              can('marketing:edit') && (
                <Btn
                  size="sm"
                  tone="ghost"
                  className="text-red-600"
                  onClick={async () => {
                    if (!window.confirm(`Remove the redirect from ${r.fromPath}?`)) return;
                    await run(
                      () => apiFetch(`/admin/redirects/${r.id}`, { method: 'DELETE' }),
                      'Redirect removed',
                    );
                    await reload();
                  }}
                >
                  Remove
                </Btn>
              ),
          },
        ]}
      />
    </div>
  );
}

function Sitemap() {
  const { data, error, reload } = useApi<{
    categories: number;
    products: number;
    stores: number;
    pages: number;
    hidden: number;
    path: string;
  }>('/admin/seo/sitemap');
  const store = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Categories" value={count(data.categories)} />
        <Stat label="Products" value={count(data.products)} />
        <Stat label="Stores" value={count(data.stores)} />
        <Stat label="Pages" value={count(data.pages)} />
        <Stat label="Hidden" value={count(data.hidden)} hint="noindex" />
      </div>
      <Card>
        <p className="text-sm text-slate-600">
          The sitemap is generated automatically and refreshed every 10 minutes:{' '}
          <a
            className="text-teal-600 underline"
            href={`${store}${data.path}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            {store}
            {data.path}
          </a>
          . Submit it once in Google Search Console.
        </p>
      </Card>
    </div>
  );
}

/** SEO (5.7 SeoManager): meta tags per category and page, sitemap and redirects. */
export function SeoPage() {
  const [tab, setTab] = useState<'meta' | 'redirects' | 'sitemap'>('meta');
  return (
    <div>
      <PageHeader
        title="SEO"
        description="How Trustlon pages look in Google and when shared, which pages search engines see, and redirects for moved pages."
      />
      <Tabs
        label="SEO"
        value={tab}
        onChange={setTab}
        tabs={[
          { key: 'meta', label: 'Titles and descriptions' },
          { key: 'redirects', label: 'Redirects' },
          { key: 'sitemap', label: 'Sitemap' },
        ]}
      />
      {tab === 'meta' ? <MetaTags /> : tab === 'redirects' ? <Redirects /> : <Sitemap />}
    </div>
  );
}
