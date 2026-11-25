'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Badge,
  Btn,
  EmptyState,
  ErrorState,
  Loading,
  PageHeader,
  SearchInput,
  Toggle,
  useAction,
} from '@/components/ui';
import { ListSelect } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { ApiError, apiFetch } from '@/lib/http';

interface LanguageInfo {
  code: string;
  api: string;
  name: string;
  native: string;
  dir: 'ltr' | 'rtl';
  locale: string;
}

/** Built-in storefront text comes from the storefront itself (proxied by next.config.ts). */
async function storefront<T>(path: string): Promise<T> {
  const response = await fetch(`/storefront-i18n${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!response.ok)
    throw new Error('Couldn’t load the storefront text. Is the storefront running?');
  return (await response.json()) as T;
}

const SECTION_NAMES: Record<string, string> = {
  common: 'Shared words',
  brandPanel: 'Sign-in side panel',
  footer: 'Footer links',
  fields: 'Form labels',
  placeholders: 'Form placeholders',
  validation: 'Form errors',
  passwordRules: 'Password rules',
  identifier: 'Email or mobile switch',
  otp: 'Verification code',
  signup: 'Sign up',
  login: 'Sign in',
  reset: 'Reset password',
  accountNav: 'Account menu',
  home: 'Home',
  sell: 'Sell on Trustlon page',
};

const PAGE_SIZE = 40;

function Row({
  id,
  built,
  english,
  edited,
  untranslated,
  lang,
  dir,
  canEdit,
  onSave,
  onReset,
}: {
  id: string;
  built: string;
  english: string;
  edited: string | undefined;
  untranslated: boolean;
  lang: string;
  dir: 'ltr' | 'rtl';
  canEdit: boolean;
  onSave: (value: string) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const current = edited ?? built;
  const [draft, setDraft] = useState(current);
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(current), [current]);
  const missing = (english.match(/\{\w+\}/g) ?? []).filter((p) => !draft.includes(p));
  const changed = draft !== current;
  const go = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <code className="break-all text-xs text-slate-500">{id}</code>
        {edited !== undefined && <Badge tone="success">Edited</Badge>}
        {untranslated && edited === undefined && <Badge tone="warning">Showing English</Badge>}
      </div>
      <label className="sr-only" htmlFor={`t-${id}`}>
        Text for {id}
      </label>
      <textarea
        id={`t-${id}`}
        lang={lang}
        dir={dir}
        rows={draft.length > 90 ? 3 : 1}
        maxLength={5000}
        value={draft}
        readOnly={!canEdit}
        onChange={(e) => setDraft(e.target.value)}
        className="block w-full resize-y rounded-lg border border-slate-300 px-3 py-2 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
      />
      {lang !== 'en-IN' && (
        <p className="mt-1.5 text-xs text-slate-500">
          English: <span lang="en">{english}</span>
        </p>
      )}
      {missing.length > 0 && (
        <p className="mt-1.5 text-xs text-red-600">
          Keep {missing.join(', ')} in the text: it’s filled in with a real value.
        </p>
      )}
      {canEdit && (changed || edited !== undefined) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {changed ? (
            <>
              <Btn
                size="sm"
                tone="primary"
                loading={busy}
                disabled={!draft.trim() || missing.length > 0}
                onClick={() => void go(() => onSave(draft))}
              >
                Save
              </Btn>
              <Btn size="sm" onClick={() => setDraft(current)}>
                Cancel
              </Btn>
            </>
          ) : (
            <Btn size="sm" tone="outline" loading={busy} onClick={() => void go(onReset)}>
              Use original text
            </Btn>
          )}
        </div>
      )}
    </li>
  );
}

const flatten = (node: unknown, prefix = '', out: Record<string, string> = {}) => {
  if (typeof node === 'string') out[prefix] = node;
  else if (node && typeof node === 'object')
    for (const [k, v] of Object.entries(node)) flatten(v, prefix ? `${prefix}.${k}` : k, out);
  return out;
};

/** Localisation (5.9 /settings/localisation): change any storefront text, in any language. */
export function LocalisationPage() {
  const { can } = useAuth();
  const run = useAction();
  const canEdit = can('settings:edit');
  const [languages, setLanguages] = useState<LanguageInfo[] | null>(null);
  const [language, setLanguage] = useState('en');
  const [english, setEnglish] = useState<Record<string, string>>({});
  const [built, setBuilt] = useState<Record<string, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [section, setSection] = useState('all');
  const [query, setQuery] = useState('');
  const [onlyEdited, setOnlyEdited] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const info = languages?.find((l) => l.code === language);

  useEffect(() => {
    Promise.all([
      storefront<{ languages: LanguageInfo[] }>(''),
      storefront<{ dictionary: unknown }>('/en'),
    ])
      .then(([list, en]) => {
        setLanguages(list.languages);
        setEnglish(flatten(en.dictionary));
      })
      .catch(setError);
  }, []);

  const load = useCallback(async (lang: LanguageInfo) => {
    setLoading(true);
    try {
      const [dictionary, { items }] = await Promise.all([
        storefront<{ dictionary: unknown }>(`/${lang.code}`),
        apiFetch<{ items: Array<{ key: string; value: string }> }>(
          `/admin/settings/localisation/content?language=${lang.api}`,
        ),
      ]);
      setBuilt(flatten(dictionary.dictionary));
      setEdits(Object.fromEntries(items.map((i) => [i.key, i.value])));
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (info) void load(info);
  }, [info, load]);
  useEffect(() => setLimit(PAGE_SIZE), [language, section, query, onlyEdited]);

  const keys = useMemo(() => Object.keys(english), [english]);
  const sections = useMemo(
    () => [
      { value: 'all', label: 'All sections' },
      ...[...new Set(keys.map((k) => k.split('.')[0]))].map((s) => ({
        value: s,
        label: SECTION_NAMES[s] ?? s,
        detail: s,
      })),
    ],
    [keys],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return keys.filter((k) => {
      if (section !== 'all' && !k.startsWith(`${section}.`)) return false;
      if (onlyEdited && edits[k] === undefined) return false;
      if (!q) return true;
      return [k, english[k], built[k] ?? '', edits[k] ?? ''].some((t) =>
        t.toLowerCase().includes(q),
      );
    });
  }, [keys, section, onlyEdited, query, english, built, edits]);

  if (error && !languages) return <ErrorState error={error} />;
  if (!languages || !info) return <Loading />;

  const fail = (err: unknown) =>
    err instanceof ApiError && err.message ? err.message : 'Couldn’t save that text';

  return (
    <div>
      <PageHeader
        back={{ href: '/settings', label: 'Settings' }}
        title="Localisation"
        description="Change any heading, button, message or help text on the storefront, in any language. Customers see it within a minute."
      />
      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
        <ListSelect
          label="Language"
          value={language}
          onChange={setLanguage}
          options={languages.map((l) => ({
            value: l.code,
            label: l.native,
            detail: l.name,
            lang: l.locale,
            keywords: l.name,
          }))}
        />
        <ListSelect label="Section" value={section} onChange={setSection} options={sections} />
        <div className="sm:col-span-2 lg:col-span-1">
          <p className="mb-1.5 text-sm font-medium text-navy">Search text</p>
          <SearchInput value={query} onChange={setQuery} placeholder="e.g. Create account" />
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600" aria-live="polite">
          {loading
            ? 'Loading…'
            : `${rows.length} texts · ${Object.keys(edits).length} edited in ${info.name}`}
        </p>
        <div className="w-40">
          <Toggle label="Only edited" checked={onlyEdited} onChange={setOnlyEdited} />
        </div>
      </div>
      {error ? <ErrorState error={error} onRetry={() => void load(info)} /> : null}
      {rows.length === 0 && !loading ? (
        <EmptyState title="No text matches" body="Try another word or section." />
      ) : (
        <ul className="space-y-3">
          {rows.slice(0, limit).map((key) => (
            <Row
              key={`${language}:${key}`}
              id={key}
              built={built[key] ?? english[key]}
              english={english[key]}
              edited={edits[key]}
              untranslated={language !== 'en' && (built[key] ?? english[key]) === english[key]}
              lang={info.locale}
              dir={info.dir}
              canEdit={canEdit}
              onSave={async (value) => {
                const ok = await run(async () => {
                  try {
                    await apiFetch('/admin/settings/localisation/content', {
                      method: 'PUT',
                      body: { language: info.api, key, value },
                    });
                  } catch (err) {
                    throw new Error(fail(err));
                  }
                  return true;
                }, 'Saved. Customers see it within a minute.');
                if (ok) setEdits((e) => ({ ...e, [key]: value }));
              }}
              onReset={async () => {
                const ok = await run(async () => {
                  await apiFetch(
                    `/admin/settings/localisation/content?language=${info.api}&key=${encodeURIComponent(key)}`,
                    { method: 'DELETE' },
                  );
                  return true;
                }, 'Original text restored');
                if (ok)
                  setEdits((e) => {
                    const next = { ...e };
                    delete next[key];
                    return next;
                  });
              }}
            />
          ))}
        </ul>
      )}
      {rows.length > limit && (
        <div className="mt-4 text-center">
          <Btn onClick={() => setLimit((n) => n + PAGE_SIZE)}>
            Show more ({rows.length - limit} left)
          </Btn>
        </div>
      )}
    </div>
  );
}
