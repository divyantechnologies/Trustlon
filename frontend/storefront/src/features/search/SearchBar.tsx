'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, cn, focusRing, inputClass } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { homeApi } from '../home/api';
import { readLocal, writeLocal } from '../home/guest';
import { Icon } from '../home/components/Icon';
import type { Suggestions } from '../home/types';
import { normalizeSearch, recentSearches, searchHref } from './query';

const RECENT_KEY = 'tl_recent_searches';
type Option = { name: string; kind: string; category?: string; store?: string };

/** Shared header search: URL navigation, keyboard suggestions and private local history. */
export function SearchBar({ initialQuery = '' }: { initialQuery?: string }) {
  const router = useRouter();
  const { language } = useI18n();
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const [recent, setRecent] = useState<string[]>([]);
  const [result, setResult] = useState<Suggestions | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const input = useRef<HTMLInputElement>(null);
  const listId = useId();
  const inputId = useId();
  const normalized = normalizeSearch(query);

  useEffect(() => {
    setQuery(initialQuery);
    setActive(-1);
    setFocused(false);
  }, [initialQuery]);
  useEffect(() => {
    setRecent(recentSearches(readLocal<unknown>(RECENT_KEY, [])));
  }, []);
  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    setStatus('loading');
    setResult(null);
    setActive(-1);
    const timer = window.setTimeout(() => {
      void homeApi
        .suggest(normalized, controller.signal)
        .then((data) => {
          if (!controller.signal.aborted) {
            setResult(data);
            setStatus('ready');
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) setStatus('error');
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [normalized, focused]);

  const current = result?.query === normalized ? result : null;
  const options: Option[] = [
    ...(!normalized ? recent.map((name) => ({ name, kind: 'Recent search' })) : []),
    ...(current?.products ?? []).map(({ name }) => ({
      name,
      kind: normalized ? 'Product' : 'Popular product',
    })),
    ...(current?.categories ?? []).map(({ name, slug }) => ({
      name,
      category: slug,
      kind: 'Category',
    })),
    ...(current?.brands ?? []).map(({ name }) => ({ name, kind: 'Brand' })),
    ...(current?.stores ?? []).map(({ name, slug }) => ({ name, store: slug, kind: 'Store' })),
  ];

  function submit(option?: Option) {
    const q = normalizeSearch(option?.name ?? query);
    if (q) {
      const next = recentSearches([q, ...recent]);
      setRecent(next);
      writeLocal(RECENT_KEY, next);
    }
    setQuery(q);
    setFocused(false);
    setActive(-1);
    router.push(
      searchHref({
        q,
        sort: 'relevance',
        page: 1,
        autocorrect: true,
        category: option?.category,
        store: option?.store,
      }),
    );
  }

  return (
    <form
      role="search"
      className="relative col-span-2 min-w-0 lg:col-span-1"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node)) {
          setFocused(false);
          setActive(-1);
        }
      }}
    >
      <label htmlFor={inputId} className="sr-only">
        Search products, categories and brands
      </label>
      <input
        ref={input}
        id={inputId}
        role="combobox"
        autoComplete="off"
        maxLength={100}
        aria-autocomplete="list"
        aria-expanded={focused}
        aria-controls={focused ? listId : undefined}
        aria-activedescendant={
          focused && active >= 0 && options[active] ? `${listId}-${active}` : undefined
        }
        value={query}
        placeholder={
          language === 'hi'
            ? 'उत्पाद, ब्रांड और स्टोर खोजें'
            : 'Search for products, brands and more'
        }
        className={cn(inputClass(false), 'pr-24')}
        onFocus={() => setFocused(true)}
        onChange={(event) => {
          setQuery(event.target.value);
          setActive(-1);
          setFocused(true);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setFocused(false);
            setActive(-1);
          }
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setFocused(true);
            setActive((index) =>
              event.key === 'ArrowDown'
                ? Math.min(index + 1, options.length - 1)
                : Math.max(-1, index - 1),
            );
          }
          if (event.key === 'Enter' && focused && active >= 0 && options[active]) {
            event.preventDefault();
            submit(options[active]);
          }
        }}
      />
      {query && (
        <button
          type="button"
          aria-label="Clear search"
          className={cn('absolute right-11 top-0 h-11 w-11 rounded-lg text-slate-500', focusRing)}
          onClick={() => {
            setQuery('');
            setActive(-1);
            input.current?.focus();
            setFocused(true);
          }}
        >
          <span aria-hidden="true">×</span>
        </button>
      )}
      <button
        type="submit"
        aria-label="Search"
        className={cn(
          'absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-navy',
          focusRing,
        )}
      >
        <Icon name="search" />
      </button>
      {focused && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="flex items-center justify-between gap-2 px-3 py-2">
            <p className="text-xs text-slate-500">
              {normalized ? 'Suggestions' : 'Recent searches & popular products'}
            </p>
            {!normalized && recent.length > 0 && (
              <Button
                type="button"
                variant="link"
                onClick={() => {
                  setRecent([]);
                  writeLocal(RECENT_KEY, []);
                }}
              >
                Clear history
              </Button>
            )}
          </div>
          <ul id={listId} role="listbox" aria-label="Search suggestions">
            {options.map((option, index) => (
              <li
                key={`${option.kind}-${option.name}-${index}`}
                id={`${listId}-${index}`}
                role="option"
                aria-selected={index === active}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => submit(option)}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-navy-50',
                  index === active && 'bg-navy-50',
                )}
              >
                <span className="min-w-0 break-words text-sm">{option.name}</span>
                <span className="shrink-0 text-xs text-slate-500">{option.kind}</span>
              </li>
            ))}
          </ul>
          <p role="status" className="px-3 py-2 text-sm text-slate-500">
            {status === 'loading'
              ? 'Loading suggestions…'
              : status === 'error'
                ? 'Suggestions unavailable. Press Enter to search.'
                : !options.length
                  ? 'No suggestions. Try another term or press Enter to search.'
                  : current?.correctedQuery
                    ? `Suggestions for “${current.correctedQuery}”`
                    : ''}
          </p>
        </div>
      )}
    </form>
  );
}
