'use client';

import Link from 'next/link';
import { Badge, ErrorState, Loading, PageHeader } from '@/components/ui';
import { focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface GroupInfo {
  group: string;
  label: string;
  description: string;
  superAdminOnly: boolean;
  canEdit: boolean;
  version: number;
  updatedAt: string | null;
}

const EXTRA = [
  {
    href: '/settings/localisation',
    label: 'Localisation',
    description: 'Every storefront label and message, in all 16 languages',
  },
];

/** Platform settings (5.9): configure the business without a code release. */
export function SettingsIndex() {
  const { data, error, reload } = useApi<{ items: GroupInfo[] }>('/admin/settings');
  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data) return <Loading />;
  const groups = data.items.filter((g) => g.group !== 'prime');
  return (
    <div>
      <PageHeader
        title="Settings"
        description="Change how Trustlon works without a new release. Every change is versioned and written to the audit log."
      />
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {groups.map((g) => (
          <li key={g.group}>
            <Link
              href={`/settings/${g.group}`}
              className={cn(
                'block h-full rounded-lg border border-slate-200 bg-white p-4 transition hover:border-teal hover:shadow-sm',
                focusRing,
              )}
            >
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-navy">{g.label}</h2>
                {g.superAdminOnly && <Badge tone="navy">Super Admin</Badge>}
                {!g.canEdit && <Badge>View only</Badge>}
              </div>
              <p className="mt-1 text-sm text-slate-600">{g.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                {g.version
                  ? `Version ${g.version} · ${dateTime(g.updatedAt)}`
                  : 'Original settings'}
              </p>
            </Link>
          </li>
        ))}
        {EXTRA.map((x) => (
          <li key={x.href}>
            <Link
              href={x.href}
              className={cn(
                'block h-full rounded-lg border border-slate-200 bg-white p-4 transition hover:border-teal hover:shadow-sm',
                focusRing,
              )}
            >
              <h2 className="font-semibold text-navy">{x.label}</h2>
              <p className="mt-1 text-sm text-slate-600">{x.description}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
