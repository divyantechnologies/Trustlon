'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Dialog, focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { humanize } from '@/lib/format';

/* Buttons that size to their content (the design-system Button is full width for forms). */

type Tone = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';

export function Btn({
  tone = 'secondary',
  size = 'md',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone;
  size?: 'sm' | 'md';
  loading?: boolean;
}) {
  return (
    <button
      type="button"
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
        size === 'sm' ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-sm',
        tone === 'primary' && 'bg-navy text-white shadow-sm hover:bg-navy-700',
        tone === 'secondary' && 'border border-slate-300 bg-white text-navy hover:bg-slate-50',
        tone === 'outline' && 'border border-navy/20 bg-transparent text-navy hover:bg-navy-50',
        tone === 'danger' && 'bg-red-600 text-white shadow-sm hover:bg-red-700',
        tone === 'ghost' && 'text-slate-600 hover:bg-slate-100 hover:text-navy',
        className,
      )}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

export function LinkBtn({
  href,
  tone = 'secondary',
  size = 'md',
  className,
  children,
  external = false,
}: {
  href: string;
  tone?: Tone;
  size?: 'sm' | 'md';
  className?: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const classes = cn(
    'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition',
    focusRing,
    size === 'sm' ? 'h-9 px-3 text-xs' : 'h-10 px-4 text-sm',
    tone === 'primary' && 'bg-navy text-white shadow-sm hover:bg-navy-700',
    tone === 'secondary' && 'border border-slate-300 bg-white text-navy hover:bg-slate-50',
    tone === 'outline' && 'border border-navy/20 text-navy hover:bg-navy-50',
    tone === 'ghost' && 'text-slate-600 hover:bg-slate-100',
    className,
  );
  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {children}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

/* Page structure */

export function PageHeader({
  title,
  description,
  actions,
  back,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link
          href={back.href}
          className={cn(
            'mb-2 inline-flex items-center gap-1 rounded text-sm text-slate-500 hover:text-navy',
            focusRing,
          )}
        >
          <span aria-hidden>←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold text-navy sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-slate-600">{description}</p>}
          {meta && <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div>}
        </div>
        {actions && <div className="flex flex-wrap gap-2 sm:justify-end">{actions}</div>}
      </div>
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn('min-w-0 rounded-lg border border-slate-200 bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="font-semibold text-navy">{title}</h2>}
            {description && <p className="text-xs text-slate-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
        </div>
      )}
      <div className={padded ? 'p-4 sm:p-5' : ''}>{children}</div>
    </section>
  );
}

/* Badges */

export type BadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'navy';

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold',
        tone === 'neutral' && 'bg-slate-100 text-slate-700',
        tone === 'success' && 'bg-teal-50 text-teal-600',
        tone === 'warning' && 'bg-amber-50 text-amber-700',
        tone === 'danger' && 'bg-red-50 text-red-700',
        tone === 'info' && 'bg-navy-50 text-navy',
        tone === 'navy' && 'bg-navy text-white',
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: 'success',
  LIVE: 'success',
  APPROVED: 'success',
  PASSED: 'success',
  VERIFIED: 'success',
  PAID: 'success',
  DELIVERED: 'success',
  PUBLISHED: 'success',
  PROCESSED: 'success',
  ACTIONED: 'success',
  REFUNDED: 'info',
  RETURNED: 'info',
  PENDING: 'warning',
  PENDING_APPROVAL: 'warning',
  SUBMITTED: 'warning',
  MORE_INFO_REQUIRED: 'warning',
  CHANGES_REQUESTED: 'warning',
  UNDER_MODERATION: 'warning',
  FLAGGED: 'warning',
  OPEN: 'warning',
  RETURN_REQUESTED: 'warning',
  PARTIALLY_REFUNDED: 'warning',
  PLACED: 'info',
  CONFIRMED: 'info',
  PACKED: 'info',
  SHIPPED: 'info',
  OUT_FOR_DELIVERY: 'info',
  SUSPENDED: 'danger',
  BLOCKED: 'danger',
  REJECTED: 'danger',
  FAILED: 'danger',
  CANCELLED: 'danger',
  INACTIVE: 'neutral',
  DRAFT: 'neutral',
  NOT_STARTED: 'neutral',
  NOT_REQUIRED: 'neutral',
  DISMISSED: 'neutral',
};

export function StatusBadge({
  value,
  label,
}: {
  value: string | null | undefined;
  label?: string;
}) {
  if (!value) return <Badge>—</Badge>;
  return <Badge tone={STATUS_TONES[value] ?? 'neutral'}>{label ?? humanize(value)}</Badge>;
}

/* States */

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 py-10 text-slate-500">
      <span
        aria-hidden
        className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-navy"
      />
      {label}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof Error && error.message ? error.message : 'Something went wrong.';
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700"
    >
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn('mt-2 rounded font-semibold underline', focusRing)}
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {body && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

/* Tabs */

export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
}: {
  tabs: Array<{ key: T; label: string; count?: number }>;
  value: T;
  onChange: (key: T) => void;
  label: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className="-mx-4 mb-4 flex gap-1 overflow-x-auto border-b border-slate-200 px-4 sm:mx-0 sm:px-0"
    >
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={tab.key === value}
          onClick={() => onChange(tab.key)}
          className={cn(
            '-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-sm',
            focusRing,
            tab.key === value
              ? 'border-teal font-semibold text-navy'
              : 'border-transparent text-slate-600 hover:text-navy',
          )}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span
              className={cn(
                'rounded-full px-1.5 text-[11px]',
                tab.key === value ? 'bg-navy text-white' : 'bg-slate-100 text-slate-600',
              )}
            >
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

/* Filters */

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search',
  label = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (text === value) return;
    const timer = window.setTimeout(() => onChange(text), 350);
    return () => window.clearTimeout(timer);
  }, [text, value, onChange]);
  return (
    <label className={cn('relative block min-w-0 flex-1', className)}>
      <span className="sr-only">{label}</span>
      <svg
        aria-hidden
        viewBox="0 0 20 20"
        className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <circle cx="9" cy="9" r="6" />
        <path d="m14 14 4 4" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        value={text}
        placeholder={placeholder}
        onChange={(e) => setText(e.target.value)}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white pe-3 ps-9 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
      />
    </label>
  );
}

/** A compact native select for filter bars. */
export function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: T | '';
  onChange: (value: T | '') => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn('min-w-0', className)}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value as T | '')}
        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
      >
        <option value="">{label}: all</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      {children}
    </div>
  );
}

/* Tables: a table on wider screens, stacked cards on phones. */

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  className?: string;
  /** Shown as the first line of the phone card. */
  primary?: boolean;
  /** Left out of the phone card. */
  hideOnMobile?: boolean;
  align?: 'start' | 'end';
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  caption,
}: {
  columns: Array<Column<T>>;
  rows: T[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  empty?: React.ReactNode;
  caption: string;
}) {
  if (rows.length === 0) return <>{empty ?? <EmptyState title="Nothing here yet" />}</>;
  const primary = columns.find((c) => c.primary) ?? columns[0];
  return (
    <>
      <div className="hidden overflow-x-auto rounded-lg border border-slate-200 bg-white md:block">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'px-4 py-3 font-semibold',
                    column.align === 'end' && 'text-end',
                    column.className,
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={rowKey(row)} className="align-top hover:bg-slate-50/60">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn(
                      'px-4 py-3',
                      column.align === 'end' && 'text-end',
                      column.className,
                    )}
                  >
                    {column === primary && rowHref ? (
                      <Link
                        href={rowHref(row)}
                        className={cn(
                          'rounded font-medium text-navy hover:text-teal-600 hover:underline',
                          focusRing,
                        )}
                      >
                        {column.cell(row)}
                      </Link>
                    ) : (
                      column.cell(row)
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden" aria-label={caption}>
        {rows.map((row) => {
          const body = (
            <>
              <div className="font-medium text-navy">{primary.cell(row)}</div>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                {columns
                  .filter((c) => c !== primary && !c.hideOnMobile)
                  .map((column) => (
                    <div key={column.key} className="min-w-0">
                      <dt className="text-slate-500">{column.header}</dt>
                      <dd className="break-words text-navy">{column.cell(row)}</dd>
                    </div>
                  ))}
              </dl>
            </>
          );
          return (
            <li key={rowKey(row)}>
              {rowHref ? (
                <Link
                  href={rowHref(row)}
                  className={cn(
                    'block rounded-lg border border-slate-200 bg-white p-3 hover:border-teal',
                    focusRing,
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className="rounded-lg border border-slate-200 bg-white p-3">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total: number;
  onPage: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <nav
      aria-label="Pages"
      className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600"
    >
      <span>
        Page {page} of {totalPages} · {total.toLocaleString('en-IN')} total
      </span>
      <div className="flex gap-2">
        <Btn size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Btn>
        <Btn size="sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>
          Next
        </Btn>
      </div>
    </nav>
  );
}

/* Small pieces */

export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  href,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'alert';
  href?: string;
}) {
  const body = (
    <>
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums sm:text-2xl',
          tone === 'alert' ? 'text-amber-700' : 'text-navy',
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
    </>
  );
  const classes = 'block min-w-0 rounded-lg border border-slate-200 bg-white p-4';
  return href ? (
    <Link href={href} className={cn(classes, 'hover:border-teal', focusRing)}>
      {body}
    </Link>
  ) : (
    <div className={classes}>{body}</div>
  );
}

export function KeyValues({
  items,
  columns = 2,
}: {
  items: Array<[string, React.ReactNode]>;
  columns?: 1 | 2 | 3;
}) {
  return (
    <dl
      className={cn(
        'grid grid-cols-1 gap-x-6 gap-y-3 text-sm',
        columns >= 2 && 'sm:grid-cols-2',
        columns === 3 && 'lg:grid-cols-3',
      )}
    >
      {items.map(([key, value]) => (
        <div key={key} className="min-w-0">
          <dt className="text-xs text-slate-500">{key}</dt>
          <dd className="mt-0.5 break-words text-navy">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: React.ReactNode;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
        </label>
        {description && <p className="text-xs text-slate-500">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-50',
          focusRing,
          checked ? 'bg-teal' : 'bg-slate-300',
        )}
      >
        <span
          aria-hidden
          className={cn(
            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition',
            checked
              ? 'translate-x-[18px] rtl:-translate-x-[18px]'
              : 'translate-x-0.5 rtl:-translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  maxLength,
  hint,
  error,
  placeholder,
  required,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  maxLength?: number;
  hint?: React.ReactNode;
  error?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy">
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-invalid={Boolean(error) || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'block w-full resize-y rounded-lg border bg-white px-3 py-2 text-sm text-navy outline-none focus:ring-4',
          error
            ? 'border-red-600 focus:ring-red-600/15'
            : 'border-slate-300 focus:border-teal focus:ring-teal/15',
        )}
      />
      {error ? (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

/** Number input with a unit, kept as text while typing. */
export function NumberInput({
  label,
  value,
  onChange,
  unit,
  min,
  max,
  step = 1,
  hint,
  error,
  disabled,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  hint?: React.ReactNode;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const [text, setText] = useState(value === null ? '' : String(value));
  useEffect(() => setText(value === null ? '' : String(value)), [value]);
  const n = Number(text);
  const outOfRange =
    text !== '' &&
    (Number.isNaN(n) || (min !== undefined && n < min) || (max !== undefined && n > max));
  const message = error ?? (outOfRange ? `Use ${min ?? '…'} to ${max ?? '…'}` : undefined);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={text}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-invalid={Boolean(message) || undefined}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value === '') onChange(null);
            else if (!Number.isNaN(Number(e.target.value))) onChange(Number(e.target.value));
          }}
          className={cn(
            'h-10 w-full min-w-0 rounded-lg border bg-white px-3 text-sm text-navy outline-none focus:ring-4 disabled:opacity-60 sm:w-36',
            message
              ? 'border-red-600 focus:ring-red-600/15'
              : 'border-slate-300 focus:border-teal focus:ring-teal/15',
          )}
        />
        {unit && <span className="shrink-0 text-sm text-slate-500">{unit}</span>}
      </div>
      {message ? (
        <p className="mt-1.5 text-xs text-red-600">{message}</p>
      ) : hint ? (
        <p className="mt-1.5 text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

/* Confirm with a reason: every admin action that changes data asks why (audit log). */

export function ReasonDialog({
  open,
  title,
  description,
  confirmLabel,
  tone = 'primary',
  reasonLabel = 'Reason (saved in the audit log)',
  reasonRequired = true,
  placeholder,
  onClose,
  onConfirm,
  children,
  canConfirm = true,
}: {
  open: boolean;
  title: string;
  description?: React.ReactNode;
  confirmLabel: string;
  tone?: 'primary' | 'danger';
  reasonLabel?: string;
  reasonRequired?: boolean;
  placeholder?: string;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<unknown>;
  children?: React.ReactNode;
  canConfirm?: boolean;
}) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setReason('');
      setError(null);
    }
  }, [open]);
  const tooShort = reasonRequired && reason.trim().length < 3;
  return (
    <Dialog open={open} title={title} onClose={() => !busy && onClose()}>
      <form
        className="space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          if (tooShort || !canConfirm) return;
          setBusy(true);
          setError(null);
          try {
            await onConfirm(reason.trim());
            onClose();
          } catch (err) {
            setError(
              err instanceof Error && err.message
                ? err.message
                : 'That didn’t work. Please try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {description && <div className="text-sm text-slate-600">{description}</div>}
        {children}
        <TextArea
          label={reasonLabel}
          value={reason}
          onChange={setReason}
          maxLength={500}
          placeholder={placeholder}
          required={reasonRequired}
        />
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Btn onClick={onClose} disabled={busy}>
            Cancel
          </Btn>
          <Btn
            type="submit"
            tone={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            disabled={tooShort || !canConfirm}
          >
            {confirmLabel}
          </Btn>
        </div>
      </form>
    </Dialog>
  );
}

/* Toasts */

interface ToastItem {
  id: number;
  text: string;
  tone: 'success' | 'error';
}

const ToastContext = createContext<(text: string, tone?: 'success' | 'error') => void>(
  () => undefined,
);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);
  const notify = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    const id = next.current++;
    setItems((current) => [...current, { id, text, tone }]);
    window.setTimeout(() => setItems((current) => current.filter((t) => t.id !== id)), 4500);
  }, []);
  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role={t.tone === 'error' ? 'alert' : 'status'}
            className={cn(
              'pointer-events-auto w-full max-w-md rounded-lg px-4 py-3 text-sm shadow-lg',
              t.tone === 'success' ? 'bg-navy text-white' : 'bg-red-600 text-white',
            )}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Runs an action, toasts the result and returns whether it worked. */
export function useAction() {
  const notify = useToast();
  return useMemo(
    () =>
      async function run<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
        try {
          const result = await action();
          if (success) notify(success);
          return result;
        } catch (error) {
          notify(
            error instanceof Error && error.message
              ? error.message
              : 'That didn’t work. Please try again.',
            'error',
          );
          return undefined;
        }
      },
    [notify],
  );
}
