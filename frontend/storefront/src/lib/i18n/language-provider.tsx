'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { en, type Dictionary, type PartialDictionary } from './en';
import { hi } from './hi';
import { isLanguage, languageInfo, type Language } from './languages';

export {
  LANGUAGE_GROUPS,
  LANGUAGES,
  fromApiLanguage,
  toApiLanguage,
  type ApiLanguage,
  type Language,
} from './languages';

const STORAGE_KEY = 'tl_lang';

/** English and Hindi ship with the page; the others load when chosen. */
const loaders: Record<Exclude<Language, 'en' | 'hi'>, () => Promise<PartialDictionary>> = {
  bn: () => import('./bn').then((m) => m.bn),
  mr: () => import('./mr').then((m) => m.mr),
  ta: () => import('./ta').then((m) => m.ta),
  te: () => import('./te').then((m) => m.te),
  kn: () => import('./kn').then((m) => m.kn),
  ml: () => import('./ml').then((m) => m.ml),
  ar: () => import('./ar').then((m) => m.ar),
  fr: () => import('./fr').then((m) => m.fr),
  es: () => import('./es').then((m) => m.es),
  de: () => import('./de').then((m) => m.de),
  pt: () => import('./pt').then((m) => m.pt),
  ru: () => import('./ru').then((m) => m.ru),
  zh: () => import('./zh').then((m) => m.zh),
  ja: () => import('./ja').then((m) => m.ja),
};

/** Fills gaps in a translation with English, so a missing string never shows as blank. */
function withFallback(partial: PartialDictionary): Dictionary {
  const merge = (base: Record<string, unknown>, over: Record<string, unknown> | undefined) => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(base)) {
      const value = base[key];
      const replacement = over?.[key];
      out[key] =
        typeof value === 'string'
          ? typeof replacement === 'string' && replacement
            ? replacement
            : value
          : merge(value as Record<string, unknown>, replacement as Record<string, unknown>);
    }
    return out;
  };
  return merge(en, partial as Record<string, unknown>) as Dictionary;
}

const loaded = new Map<Language, Dictionary>([
  ['en', en],
  ['hi', withFallback(hi)],
]);

interface LanguageContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Dictionary;
  format: (template: string, values: Record<string, string | number>) => string;
  /** BCP 47 tag for dates and numbers, e.g. ta-IN. */
  locale: string;
  dir: 'ltr' | 'rtl';
  /** The built-in text for the current language, without edits (used by Admin › Settings › Localisation). */
  base: Dictionary;
  /** Reloads edited text after a change in Admin › Settings › Localisation. */
  refreshContent: () => void;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

/** The built-in text of any language, with English filling gaps (used by Admin › Settings › Localisation). */
export async function loadDictionary(language: Language): Promise<Dictionary> {
  const ready = loaded.get(language);
  if (ready) return ready;
  const full = withFallback(await loaders[language as keyof typeof loaders]());
  loaded.set(language, full);
  return full;
}

/** Text edited in Admin › Settings › Localisation, as { "signup.title": "…" }, applied over a dictionary. */
export function applyOverrides(base: Dictionary, entries: Record<string, string>): Dictionary {
  const keys = Object.keys(entries);
  if (keys.length === 0) return base;
  const out = JSON.parse(JSON.stringify(base)) as Record<string, unknown>;
  for (const key of keys) {
    const path = key.split('.');
    let node = out;
    for (const part of path.slice(0, -1)) {
      const next = node[part];
      if (!next || typeof next !== 'object') {
        node = {};
        break;
      }
      node = next as Record<string, unknown>;
    }
    const last = path[path.length - 1];
    // Only replace text that exists, so a stale key can't add junk.
    if (typeof node[last] === 'string' && entries[key]) node[last] = entries[key];
  }
  return out as Dictionary;
}

const overrideCache = new Map<string, Record<string, string>>();

function loadOverrides(language: Language, version: number): Promise<Record<string, string>> {
  const cacheKey = `${language}:${version}`;
  const hit = overrideCache.get(cacheKey);
  if (hit) return Promise.resolve(hit);
  return fetch(`/api/v1/site/content/${language}?v=${version}`, {
    headers: { Accept: 'application/json' },
  })
    .then((response) => (response.ok ? response.json() : { entries: {} }))
    .then((body: { entries?: Record<string, string> }) => {
      const entries = body.entries ?? {};
      overrideCache.set(cacheKey, entries);
      return entries;
    })
    .catch(() => ({}));
}

export function LanguageProvider({
  children,
  initialOverrides = {},
  contentVersion = 0,
}: {
  children: React.ReactNode;
  /** Edited English text loaded on the server, so the first paint already shows it. */
  initialOverrides?: Record<string, string>;
  /** Changes whenever text is edited in the admin panel; used to refresh edited text. */
  contentVersion?: number;
}) {
  const [language, setLanguageState] = useState<Language>('en');
  const [dictionary, setDictionary] = useState<Dictionary>(en);
  const [overrides, setOverrides] = useState<{
    language: Language;
    entries: Record<string, string>;
  }>({
    language: 'en',
    entries: initialOverrides,
  });
  const [version, setVersion] = useState(contentVersion);

  // The language most recently asked for, so a slow download never overrides a later choice.
  const requested = useRef<Language>('en');

  const apply = useCallback((next: Language) => {
    requested.current = next;
    const ready = loaded.get(next);
    if (ready) {
      setLanguageState(next);
      setDictionary(ready);
      return;
    }
    void loaders[next as keyof typeof loaders]()
      .then((partial) => {
        const full = withFallback(partial);
        loaded.set(next, full);
        if (requested.current !== next) return;
        setLanguageState(next);
        setDictionary(full);
      })
      .catch(() => {
        if (requested.current !== next) return;
        setLanguageState('en');
        setDictionary(en);
      });
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isLanguage(saved)) apply(saved);
    } catch {
      // Storage unavailable (private mode); keep the default language.
    }
  }, [apply]);

  // Edited text for the current language.
  useEffect(() => {
    let active = true;
    void loadOverrides(language, version).then((entries) => {
      if (active) setOverrides({ language, entries });
    });
    return () => {
      active = false;
    };
  }, [language, version]);

  const refreshContent = useCallback(() => setVersion(Date.now()), []);

  useEffect(() => {
    const info = languageInfo(language);
    document.documentElement.lang = info.locale;
    // Arabic reads right to left; the layout mirrors through logical (start/end) spacing.
    document.documentElement.dir = info.dir;
  }, [language]);

  const setLanguage = useCallback(
    (next: Language) => {
      apply(next);
      try {
        window.localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // Ignore storage errors; the choice still applies for this visit.
      }
    },
    [apply],
  );

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t:
        overrides.language === language
          ? applyOverrides(dictionary, overrides.entries)
          : dictionary,
      base: dictionary,
      refreshContent,
      dir: languageInfo(language).dir,
      locale: languageInfo(language).locale,
      format: (template, values) =>
        template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? `{${key}}`)),
    }),
    [language, setLanguage, dictionary, overrides, refreshContent],
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n(): LanguageContextValue {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}
