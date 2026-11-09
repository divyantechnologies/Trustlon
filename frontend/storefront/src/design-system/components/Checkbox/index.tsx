'use client';

import { forwardRef, useId } from 'react';
import { cn as cx } from '../../utils/cn';

export type CheckboxProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: React.ReactNode;
  error?: string;
};

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, error, id, className, ...props },
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
            'mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-teal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60',
            error && 'outline outline-1 outline-red-600',
            className,
          )}
          {...props}
        />
        <label htmlFor={inputId} className="cursor-pointer text-sm leading-5 text-navy">
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
