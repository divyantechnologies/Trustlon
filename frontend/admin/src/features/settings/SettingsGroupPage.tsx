'use client';

import { useEffect, useState } from 'react';
import { Badge, Btn, Card, ErrorState, Loading, PageHeader, useAction } from '@/components/ui';
import { Dialog } from '@/design-system';
import { ApiError, apiFetch } from '@/lib/http';
import { dateTime } from '@/lib/format';
import { useApi } from '@/lib/use-api';

export interface GroupResponse<T> {
  group: string;
  value: T;
  version: number;
  updatedAt: string | null;
  canEdit: boolean;
}

interface Version<T> {
  version: number;
  by: string;
  reason: string | null;
  at: string;
  value: T;
}

export type Setter<T> = (update: (draft: T) => T) => void;

/** Sets a nested value by path without mutating, e.g. set(d, ['fees', 'tcsPercent'], 1). */
export function setIn<T>(obj: T, path: Array<string | number>, value: unknown): T {
  if (path.length === 0) return value as T;
  const [head, ...rest] = path;
  const base = (Array.isArray(obj) ? [...obj] : { ...(obj as object) }) as Record<
    string | number,
    unknown
  >;
  base[head] = setIn(base[head], rest, value);
  return base as T;
}

/**
 * Frame for one settings group (5.9): loads it, keeps an editable draft, saves with an optional
 * note, and shows earlier versions that can be restored. All changes are versioned and audited.
 */
export function SettingsGroupPage<T>({
  group,
  title,
  description,
  back = { href: '/settings', label: 'Settings' },
  superAdminOnly = false,
  validate,
  onSaved,
  children,
}: {
  group: string;
  title: string;
  description: string;
  back?: { href: string; label: string } | null;
  superAdminOnly?: boolean;
  /** Returns an error message when the draft can't be saved. */
  validate?: (draft: T) => string | null;
  onSaved?: (value: T) => void;
  children: (
    draft: T,
    set: Setter<T>,
    ctx: {
      canEdit: boolean;
      error: { field?: string; message: string } | null;
      saved: T;
      applySaved: (result: GroupResponse<T>) => void;
    },
  ) => React.ReactNode;
}) {
  const run = useAction();
  const { data, error, reload, setData } = useApi<GroupResponse<T>>(`/admin/settings/${group}`);
  const [draft, setDraft] = useState<T | null>(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<{ field?: string; message: string } | null>(null);
  const [history, setHistory] = useState<Array<Version<T>> | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    if (data) setDraft(data.value);
  }, [data]);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!data || draft === null) return <Loading />;

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.value);
  const invalid = validate?.(draft) ?? null;
  const set: Setter<T> = (update) => {
    setSaveError(null);
    setDraft((d) => (d === null ? d : update(d)));
  };

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const result = await apiFetch<GroupResponse<T>>(`/admin/settings/${group}`, {
        method: 'PATCH',
        body: { value: draft, reason: reason.trim() || undefined },
      });
      setData({ ...result, canEdit: data.canEdit });
      setReason('');
      onSaved?.(result.value);
      setHistory(null);
    } catch (err) {
      setSaveError({
        field: err instanceof ApiError ? err.field : undefined,
        message: err instanceof Error && err.message ? err.message : 'Couldn’t save',
      });
    } finally {
      setSaving(false);
    }
  };

  const openHistory = async () => {
    setShowHistory(true);
    if (!history) {
      const result = await run(() =>
        apiFetch<{ items: Array<Version<T>> }>(`/admin/settings/${group}/versions`),
      );
      setHistory(result?.items ?? []);
    }
  };

  return (
    <div className={data.canEdit ? 'pb-28' : ''}>
      <PageHeader
        back={back ?? undefined}
        title={title}
        description={description}
        meta={
          <>
            {superAdminOnly && <Badge tone="navy">Super Admin only</Badge>}
            {!data.canEdit && <Badge>View only</Badge>}
            <span className="text-xs text-slate-500">
              {data.version
                ? `Version ${data.version} · ${dateTime(data.updatedAt)}`
                : 'Using the original settings'}
            </span>
          </>
        }
        actions={
          <Btn size="sm" onClick={() => void openHistory()} disabled={!data.version}>
            History
          </Btn>
        }
      />
      {!data.canEdit && (
        <p
          role="status"
          className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
        >
          You can see these settings but your role can’t change them.
        </p>
      )}
      <div className="min-w-0 space-y-5">
        {children(draft, set, {
          canEdit: data.canEdit,
          error: saveError,
          saved: data.value,
          applySaved: (result) => {
            setData({ ...result, canEdit: data.canEdit });
            onSaved?.(result.value);
            setHistory(null);
          },
        })}
      </div>

      {data.canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur lg:start-60">
          <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-6 lg:px-8">
            <div className="min-w-0 flex-1 text-sm" aria-live="polite">
              {saveError ? (
                <span className="text-red-600">
                  {saveError.field ? `${saveError.field}: ` : ''}
                  {saveError.message}
                </span>
              ) : invalid ? (
                <span className="text-red-600">{invalid}</span>
              ) : dirty ? (
                <input
                  aria-label="Note for this change (optional)"
                  value={reason}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Note for this change (optional, saved in history)"
                  className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
                />
              ) : (
                <span className="text-slate-500">All changes saved.</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 sm:flex">
              <Btn
                tone="ghost"
                disabled={saving}
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Put “${title}” back to the original settings? This is saved as a new version.`,
                    )
                  )
                    return;
                  const result = await run(
                    () =>
                      apiFetch<GroupResponse<T>>(`/admin/settings/${group}/reset`, {
                        method: 'POST',
                      }),
                    'Original settings restored',
                  );
                  if (result) {
                    setData({ ...result, canEdit: data.canEdit });
                    onSaved?.(result.value);
                    setHistory(null);
                  }
                }}
              >
                Restore original
              </Btn>
              <Btn disabled={!dirty || saving} onClick={() => setDraft(data.value)}>
                Undo
              </Btn>
              <Btn
                tone="primary"
                disabled={!dirty || Boolean(invalid)}
                loading={saving}
                onClick={() => void save()}
              >
                Save
              </Btn>
            </div>
          </div>
        </div>
      )}

      <Dialog open={showHistory} title={`${title}: history`} onClose={() => setShowHistory(false)}>
        {!history ? (
          <Loading />
        ) : history.length === 0 ? (
          <p className="text-sm text-slate-500">No saved versions yet.</p>
        ) : (
          <ol className="max-h-[60vh] space-y-2 overflow-y-auto">
            {history.map((v) => (
              <li
                key={v.version}
                className="flex flex-col gap-2 rounded-lg border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-navy">
                    Version {v.version}{' '}
                    {v.version === data.version && <Badge tone="success">Current</Badge>}
                  </p>
                  <p className="text-xs text-slate-500">
                    {v.by} · {dateTime(v.at)}
                  </p>
                  {v.reason && <p className="break-words text-xs text-slate-600">“{v.reason}”</p>}
                </div>
                {data.canEdit && v.version !== data.version && (
                  <Btn
                    size="sm"
                    onClick={async () => {
                      if (!window.confirm(`Make version ${v.version} current again?`)) return;
                      const result = await run(
                        () =>
                          apiFetch<GroupResponse<T>>(
                            `/admin/settings/${group}/versions/${v.version}/restore`,
                            { method: 'POST' },
                          ),
                        `Version ${v.version} restored`,
                      );
                      if (result) {
                        setData({ ...result, canEdit: data.canEdit });
                        onSaved?.(result.value);
                        setHistory(null);
                        setShowHistory(false);
                      }
                    }}
                  >
                    Restore
                  </Btn>
                )}
              </li>
            ))}
          </ol>
        )}
      </Dialog>
    </div>
  );
}

/** A titled block inside a settings page. */
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card title={title} description={description}>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}
