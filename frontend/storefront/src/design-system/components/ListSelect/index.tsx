'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { focusRing, inputClass } from '../../styles';
import { cn as cx } from '../../utils/cn';

export interface ListOption<T extends string = string> {
  value: T;
  /** Main text in the list and on the button. */
  label: string;
  /** Second line or trailing text, e.g. "+91" or "Hindi". */
  detail?: string;
  /** Short text for the closed button, e.g. "IN +91". Defaults to the label. */
  short?: string;
  /** Options with the same group are listed under that heading. */
  group?: string;
  /** Extra words that should find this option in search. */
  keywords?: string;
  /** Language of the label, so screen readers and fonts get it right. */
  lang?: string;
  disabled?: boolean;
}

export interface ListSelectProps<T extends string = string> {
  /** Field label shown above the button. Pass `hideLabel` to keep it for screen readers only. */
  label: string;
  hideLabel?: boolean;
  value: T | '';
  onChange: (value: T) => void;
  options: ReadonlyArray<ListOption<T>>;
  placeholder?: string;
  /** Show a search box. On by default when there are more than 8 options. */
  searchable?: boolean;
  searchPlaceholder?: string;
  noResultsText?: string;
  error?: string;
  hint?: React.ReactNode;
  disabled?: boolean;
  /** `field` is a full-width form control; `compact` is a small inline button. */
  variant?: 'field' | 'compact';
  /** Shown before the value on the button, e.g. a globe icon. */
  icon?: React.ReactNode;
  /** Which side the list opens on, for buttons near the edge of the screen. */
  align?: 'start' | 'end';
  className?: string;
  id?: string;
}

const normalise = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * One dropdown list for every choice in the app (languages, countries, states, phone codes,
 * reasons…): a button that opens a searchable list. Keyboard: arrows to move, Enter to pick,
 * Escape to close, and typing filters the list.
 */
export function ListSelect<T extends string = string>({
  label,
  hideLabel = false,
  value,
  onChange,
  options,
  placeholder = 'Choose',
  searchable,
  searchPlaceholder = 'Search',
  noResultsText = 'No matches',
  error,
  hint,
  disabled = false,
  variant = 'field',
  icon,
  align = 'start',
  className,
  id,
}: ListSelectProps<T>) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listId = `${buttonId}-list`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const withSearch = searchable ?? options.length > 8;

  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const q = normalise(query.trim());
    if (!q) return options.filter((o) => !o.disabled);
    return options.filter(
      (o) =>
        !o.disabled &&
        normalise(
          `${o.label} ${o.detail ?? ''} ${o.short ?? ''} ${o.keywords ?? ''} ${o.value}`,
        ).includes(q),
    );
  }, [options, query]);

  // Open on the current value, and keep the highlighted row in view.
  useEffect(() => {
    if (!open) return;
    const index = filtered.findIndex((o) => o.value === value);
    setActive(index >= 0 ? index : 0);
    window.setTimeout(() => (withSearch ? search.current : list.current)?.focus(), 0);
    // Only when the list opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  const choose = (option: ListOption<T>) => {
    onChange(option.value);
    setOpen(false);
    setQuery('');
    button.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, filtered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(filtered.length - 1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (filtered[active]) choose(filtered[active]);
    } else if (event.key === 'Escape' || event.key === 'Tab') {
      if (event.key === 'Escape') event.preventDefault();
      setOpen(false);
      setQuery('');
      if (event.key === 'Escape') button.current?.focus();
    }
  };

  const compact = variant === 'compact';
  let lastGroup: string | undefined;

  return (
    <div className={cx(!compact && 'w-full', className)}>
      <label
        htmlFor={buttonId}
        className={cx(hideLabel ? 'sr-only' : 'mb-1.5 block text-sm font-medium text-navy')}
      >
        {label}
      </label>
      <div ref={root} className={cx('relative', compact ? 'inline-block' : 'block')}>
        <button
          ref={button}
          id={buttonId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${buttonId}-error` : hint ? `${buttonId}-hint` : undefined}
          onClick={() => setOpen((v) => !v)}
          onKeyDown={(event) => {
            if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cx(
            'flex items-center gap-2 text-start',
            compact
              ? cx('h-9 rounded-lg px-2 text-sm text-slate-600 hover:bg-slate-100', focusRing)
              : cx(inputClass(Boolean(error)), 'justify-between'),
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          {icon}
          <span
            lang={selected?.lang}
            className={cx('min-w-0 flex-1 truncate', !selected && !compact && 'text-slate-400')}
          >
            {selected
              ? compact
                ? (selected.short ?? selected.label)
                : selected.label
              : placeholder}
            {selected?.detail && !compact && (
              <span className="ms-1.5 text-slate-500">{selected.detail}</span>
            )}
          </span>
          <svg
            aria-hidden
            viewBox="0 0 20 20"
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="currentColor"
          >
            <path d="M5.3 7.3a1 1 0 0 1 1.4 0L10 10.6l3.3-3.3a1 1 0 1 1 1.4 1.4l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 0-1.4Z" />
          </svg>
        </button>

        {open && (
          <div
            className={cx(
              'absolute top-full z-40 mt-1 rounded-lg border border-slate-200 bg-white shadow-lg',
              compact ? 'w-72' : 'w-full min-w-64',
              align === 'end' ? 'end-0' : 'start-0',
            )}
          >
            {withSearch && (
              <div className="border-b border-slate-100 p-2">
                <input
                  ref={search}
                  type="search"
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  onKeyDown={onKeyDown}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  aria-controls={listId}
                  aria-activedescendant={filtered[active] ? `${listId}-${active}` : undefined}
                  className="h-9 w-full rounded-md border border-slate-300 px-3 text-sm text-navy outline-none focus:border-teal focus:ring-2 focus:ring-teal/15"
                />
              </div>
            )}
            <ul
              ref={list}
              id={listId}
              role="listbox"
              aria-label={label}
              tabIndex={withSearch ? -1 : 0}
              onKeyDown={withSearch ? undefined : onKeyDown}
              aria-activedescendant={
                !withSearch && filtered[active] ? `${listId}-${active}` : undefined
              }
              className="max-h-72 overflow-y-auto py-1 outline-none"
            >
              {filtered.length === 0 && (
                <li role="presentation" className="px-3 py-2 text-sm text-slate-500">
                  {noResultsText}
                </li>
              )}
              {filtered.map((option, index) => {
                const heading = option.group && option.group !== lastGroup ? option.group : null;
                lastGroup = option.group;
                const isSelected = option.value === value;
                return (
                  <li key={option.value} role="presentation">
                    {heading && (
                      <p
                        role="presentation"
                        className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                      >
                        {heading}
                      </p>
                    )}
                    <div
                      id={`${listId}-${index}`}
                      data-index={index}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActive(index)}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => choose(option)}
                      className={cx(
                        'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                        index === active ? 'bg-navy-50' : 'bg-white',
                      )}
                    >
                      <span
                        lang={option.lang}
                        className={cx(
                          'min-w-0 flex-1 truncate text-navy',
                          isSelected && 'font-semibold',
                        )}
                      >
                        {option.label}
                      </span>
                      {option.detail && (
                        <span className="shrink-0 text-xs text-slate-500">{option.detail}</span>
                      )}
                      {isSelected && (
                        <svg
                          aria-hidden
                          viewBox="0 0 16 16"
                          className="h-4 w-4 shrink-0 text-teal-600"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
      {error ? (
        <p id={`${buttonId}-error`} role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <div id={`${buttonId}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}
