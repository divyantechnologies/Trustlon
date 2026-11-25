'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Btn,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  Tabs,
} from '@/components/ui';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { ago, humanize } from '@/lib/format';
import { useApi, useQueryState } from '@/lib/use-api';

interface FlaggedReview {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: string;
  flags: string[];
  signals: string[];
  reports: number;
  media: number;
  createdAt: string;
  author: { id: string; name: string };
  product: { id: string; name: string; slug: string; vendor: { id: string; displayName: string } };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-amber-500">
      {'★'.repeat(rating)}
      <span className="text-slate-300">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

/** Review moderation (5.8 ReviewModerationQueue): held and reported reviews with fraud signals. */
export function ReviewModeration() {
  const { can } = useAuth();
  const [f, setF] = useQueryState({ view: 'all' });
  const { data, error, reload, setData } = useApi<{ items: FlaggedReview[] }>(
    `/admin/reviews/flagged?view=${f.view}`,
  );
  const [act, setAct] = useState<null | { review: FlaggedReview; action: 'publish' | 'remove' }>(
    null,
  );

  return (
    <div>
      <PageHeader
        title="Review moderation"
        description="Reviews held by the automatic checks or reported by customers. Publishing or removing closes their reports."
      />
      <Tabs
        label="Queue"
        value={f.view as 'all' | 'held' | 'reported'}
        onChange={(view) => setF({ view })}
        tabs={[
          { key: 'all', label: 'All' },
          { key: 'held', label: 'Held by checks' },
          { key: 'reported', label: 'Reported' },
        ]}
      />
      {error ? (
        <ErrorState error={error} onRetry={reload} />
      ) : !data ? (
        <Loading />
      ) : data.items.length === 0 ? (
        <EmptyState title="Nothing to review" body="New held or reported reviews appear here." />
      ) : (
        <ul className="space-y-3">
          {data.items.map((r) => (
            <li key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2">
                    <Stars rating={r.rating} />
                    <StatusBadge value={r.status} />
                    {r.reports > 0 && (
                      <Badge tone="danger">
                        {r.reports} report{r.reports > 1 ? 's' : ''}
                      </Badge>
                    )}
                    {r.media > 0 && (
                      <Badge>
                        {r.media} photo{r.media > 1 ? 's' : ''}
                      </Badge>
                    )}
                  </p>
                  <p className="mt-1 font-semibold text-navy">{r.title}</p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm text-slate-700">
                    {r.body}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    By{' '}
                    <Link
                      className="text-teal-600 hover:underline"
                      href={`/customers/${r.author.id}`}
                    >
                      {r.author.name}
                    </Link>{' '}
                    on{' '}
                    <Link
                      className="text-teal-600 hover:underline"
                      href={`/catalog/products/${r.product.id}`}
                    >
                      {r.product.name}
                    </Link>{' '}
                    ({r.product.vendor.displayName}) · {ago(r.createdAt)}
                  </p>
                </div>
                {can('trust:approve') && (
                  <div className="flex shrink-0 gap-2">
                    <Btn
                      size="sm"
                      tone="primary"
                      onClick={() => setAct({ review: r, action: 'publish' })}
                    >
                      Publish
                    </Btn>
                    <Btn
                      size="sm"
                      tone="danger"
                      onClick={() => setAct({ review: r, action: 'remove' })}
                    >
                      Remove
                    </Btn>
                  </div>
                )}
              </div>
              {(r.signals.length > 0 || r.flags.length > 0) && (
                <ul className="mt-3 space-y-1 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
                  {r.signals.map((s) => (
                    <li key={s}>⚠ {s}</li>
                  ))}
                  {r.flags.map((s) => (
                    <li key={s}>⚑ {humanize(s)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
      <ReasonDialog
        open={Boolean(act)}
        tone={act?.action === 'remove' ? 'danger' : 'primary'}
        title={act?.action === 'remove' ? 'Remove review' : 'Publish review'}
        confirmLabel={act?.action === 'remove' ? 'Remove' : 'Publish'}
        description={
          act?.action === 'remove'
            ? 'The customer is told why. Removed reviews don’t count in the rating.'
            : 'It shows on the product page and counts in the rating.'
        }
        onClose={() => setAct(null)}
        onConfirm={async (reason) => {
          if (!act) return;
          await apiFetch(`/admin/reviews/${act.review.id}/action`, {
            method: 'POST',
            body: { action: act.action, reason },
          });
          setData({ items: (data?.items ?? []).filter((x) => x.id !== act.review.id) });
        }}
      />
    </div>
  );
}
