'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Btn,
  Card,
  ErrorState,
  Loading,
  PageHeader,
  Tabs,
  Toggle,
  useToast,
} from '@/components/ui';
import { TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, apiFetch } from '@/lib/http';
import { dateTime } from '@/lib/format';
import { Markdown, markdownClass } from '@/lib/markdown';
import { useApi } from '@/lib/use-api';

interface CmsPage {
  id: string;
  slug: string;
  title: string;
  body: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
}

const HELP =
  '## Heading · ### Smaller heading · **bold** · *italic* · [link text](/c/fashion) · - bullet · 1. numbered · --- line';

/** Create or edit a CMS page, with a live preview. */
export function PageEditor({ id }: { id: string | 'new' }) {
  const router = useRouter();
  const { can } = useAuth();
  const notify = useToast();
  const { data, error, reload } = useApi<CmsPage>(id === 'new' ? null : `/admin/pages/${id}`);
  const [form, setForm] = useState({ slug: '', title: '', body: '', isPublished: false });
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<{ field?: string; message: string } | null>(null);
  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

  useEffect(() => {
    if (data)
      setForm({
        slug: data.slug,
        title: data.title,
        body: data.body,
        isPublished: data.isPublished,
      });
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (id !== 'new' && !data) return <Loading />;

  const editable = can(id === 'new' ? 'marketing:create' : 'marketing:edit');
  const dirty =
    id === 'new'
      ? Boolean(form.title || form.body)
      : JSON.stringify(form) !==
        JSON.stringify({
          slug: data!.slug,
          title: data!.title,
          body: data!.body,
          isPublished: data!.isPublished,
        });

  const save = async () => {
    if (id === 'new' && !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(form.slug))
      return setErr({ field: 'slug', message: 'Use lower-case letters, numbers and hyphens' });
    if (form.title.trim().length < 2) return setErr({ field: 'title', message: 'Add a title' });
    setSaving(true);
    setErr(null);
    try {
      const saved = await apiFetch<CmsPage>(id === 'new' ? '/admin/pages' : `/admin/pages/${id}`, {
        method: id === 'new' ? 'POST' : 'PATCH',
        body:
          id === 'new'
            ? form
            : { title: form.title, body: form.body, isPublished: form.isPublished },
      });
      if (id === 'new') router.replace(`/marketing/pages/${saved.id}`);
      else await reload();
      notify('Page saved');
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
        back={{ href: '/marketing/pages', label: 'Pages' }}
        title={id === 'new' ? 'New page' : data!.title}
        meta={
          data && <span className="text-xs text-slate-500">Updated {dateTime(data.updatedAt)}</span>
        }
        actions={
          data?.isPublished && (
            <a
              className="text-sm text-teal-600 hover:underline"
              href={`${storefront}/pages/${data.slug}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View on store
            </a>
          )
        }
      />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-4">
          <TextField
            label="Title"
            value={form.title}
            maxLength={120}
            readOnly={!editable}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            error={err?.field === 'title' ? err.message : undefined}
          />
          <Tabs
            label="Editor"
            value={tab}
            onChange={setTab}
            tabs={[
              { key: 'write', label: 'Write' },
              { key: 'preview', label: 'Preview' },
            ]}
          />
          {tab === 'write' ? (
            <div>
              <label htmlFor="page-body" className="sr-only">
                Page text
              </label>
              <textarea
                id="page-body"
                value={form.body}
                readOnly={!editable}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                rows={22}
                maxLength={100000}
                className="block w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm leading-relaxed text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
              />
              <p className="mt-1.5 text-xs text-slate-500">{HELP}</p>
            </div>
          ) : (
            <Card>
              <h1 className="mb-4 text-2xl font-semibold text-navy">{form.title || 'Untitled'}</h1>
              <Markdown source={form.body || '*Nothing written yet.*'} className={markdownClass} />
            </Card>
          )}
        </div>
        <aside className="min-w-0 space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card title="Publishing">
            <div className="space-y-3">
              {id === 'new' ? (
                <TextField
                  label="Address"
                  value={form.slug}
                  maxLength={80}
                  hint={`/pages/${form.slug || '…'}`}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                    })
                  }
                  error={err?.field === 'slug' ? err.message : undefined}
                />
              ) : (
                <p className="text-sm text-slate-600">
                  Address: <span className="font-mono">/pages/{form.slug}</span>
                </p>
              )}
              <Toggle
                label="Published"
                description="Drafts aren’t visible to customers."
                checked={form.isPublished}
                disabled={!editable}
                onChange={(v) => setForm({ ...form, isPublished: v })}
              />
              {err && !['slug', 'title'].includes(err.field ?? '') && (
                <p className="text-sm text-red-600">{err.message}</p>
              )}
              {editable && (
                <Btn
                  tone="primary"
                  className="w-full"
                  loading={saving}
                  disabled={!dirty}
                  onClick={() => void save()}
                >
                  {id === 'new' ? 'Create page' : 'Save changes'}
                </Btn>
              )}
            </div>
          </Card>
          <p className="text-xs text-slate-500">
            Set the search title and description in Marketing › SEO.
          </p>
        </aside>
      </div>
    </div>
  );
}
