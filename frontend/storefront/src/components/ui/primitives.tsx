'use client';

import { forwardRef, useId } from 'react';

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

/* Button */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'link';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed',
        variant === 'primary' &&
          'h-11 w-full rounded-lg bg-navy px-4 text-white shadow-sm hover:bg-navy-700 disabled:bg-navy/50',
        variant === 'secondary' &&
          'h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-navy hover:bg-slate-50 disabled:opacity-60',
        variant === 'link' && 'rounded text-teal-600 hover:text-teal hover:underline disabled:opacity-60',
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

/* Field wrapper */

export function Field({
  id,
  label,
  error,
  hint,
  aside,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 flex items-start gap-1 text-xs text-red-600">
          <svg aria-hidden viewBox="0 0 16 16" className="mt-px h-3.5 w-3.5 shrink-0 fill-current">
            <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1Zm-.75 3.5h1.5v5h-1.5v-5Zm0 6h1.5V12h-1.5v-1.5Z" />
          </svg>
          {error}
        </p>
      ) : hint ? (
        <div id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export const inputClass = (invalid: boolean) =>
  cx(
    'h-11 w-full rounded-lg border bg-white px-3 text-sm text-navy shadow-sm outline-none transition placeholder:text-slate-400',
    'focus:ring-4',
    invalid
      ? 'border-red-500 focus:border-red-500 focus:ring-red-500/15'
      : 'border-slate-300 hover:border-slate-400 focus:border-teal focus:ring-teal/15',
  );

/* Text field */

type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
};

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, aside, className, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <Field id={inputId} label={label} error={error} hint={hint} aside={aside}>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={cx(inputClass(Boolean(error)), className)}
        {...props}
      />
    </Field>
  );
});

/* Checkbox */

type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: React.ReactNode;
  error?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={cx(
            'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-navy',
            error && 'outline outline-1 outline-red-500',
          )}
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-5 text-slate-600">
          {label}
        </label>
      </div>
      {error && (
        <p id={`${inputId}-error`} role="alert" className="mt-1 pl-7 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
});

/* Alert */

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex gap-2 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-800',
        tone === 'success' && 'border-teal/30 bg-teal-50 text-teal-600',
        tone === 'info' && 'border-navy/10 bg-navy-50 text-navy',
      )}
    >
      {children}
    </div>
  );
}
