'use client';

import { Badge, DataTable, ErrorState, LinkBtn, Loading, PageHeader } from '@/components/ui';
import { useAuth } from '@/features/auth/auth-provider';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface PageRow {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  publishedAt: string | null;
  updatedAt: string;
  length: number;
}

const SUGGESTED = ['about', 'terms', 'privacy', 'returns-policy', 'shipping-policy'];

/** CMS pages (5.7 CmsPages): About, Terms, Privacy, Returns policy, Shipping policy. */
export function PagesList() {
  const { can } = useAuth();
  const { data, error, reload } = useApi<{ items: PageRow[] }>('/admin/pages');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const missing = SUGGESTED.filter((s) => !data.items.some((p) => p.slug === s));
  return (
    <div>
      <PageHeader
        title="Pages"
        description="Policy and information pages on the storefront at /pages/<address>. Write in simple Markdown."
        actions={
          can('marketing:create') && (
            <LinkBtn tone="primary" size="sm" href="/marketing/pages/new">
              New page
            </LinkBtn>
          )
        }
      />
      {missing.length > 0 && can('marketing:create') && (
        <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Not created yet: {missing.join(', ')}. Every marketplace needs these before launch.
        </p>
      )}
      <DataTable
        caption="Pages"
        rows={data.items}
        rowKey={(p) => p.id}
        rowHref={(p) => `/marketing/pages/${p.id}`}
        columns={[
          { key: 'title', header: 'Page', primary: true, cell: (p) => p.title },
          {
            key: 'path',
            header: 'Address',
            cell: (p) => <span className="font-mono text-xs">/pages/{p.slug}</span>,
          },
          {
            key: 'state',
            header: 'State',
            cell: (p) =>
              p.isPublished ? <Badge tone="success">Published</Badge> : <Badge>Draft</Badge>,
          },
          { key: 'updated', header: 'Updated', cell: (p) => dateTime(p.updatedAt) },
        ]}
      />
    </div>
  );
}
