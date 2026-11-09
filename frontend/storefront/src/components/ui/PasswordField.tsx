'use client';

import { forwardRef, useId, useState } from 'react';
import { cx, Field, inputClass } from './primitives';

type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  showLabel: string;
  hideLabel: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, hint, aside, showLabel, hideLabel, id, className, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  return (
    <Field id={inputId} label={label} error={error} hint={hint} aside={aside}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cx(inputClass(Boolean(error)), 'pr-16', className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={inputId}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus-visible:text-navy"
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
    </Field>
  );
});
