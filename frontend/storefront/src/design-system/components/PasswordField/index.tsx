'use client';

import { forwardRef, useId, useState } from 'react';
import { cn as cx } from '../../utils/cn';
import { Field } from '../Field';
import { inputClass } from '../../styles';

export type PasswordFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  showLabel: string;
  hideLabel: string;
  /** Shown under the field while Caps Lock is on. */
  capsLockLabel?: string;
};

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  {
    label,
    error,
    hint,
    aside,
    showLabel,
    hideLabel,
    capsLockLabel = 'Caps Lock is on',
    id,
    className,
    onKeyDown,
    onKeyUp,
    onBlur,
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const readCapsLock = (event: React.KeyboardEvent<HTMLInputElement>) =>
    setCapsLock(event.getModifierState?.('CapsLock') ?? false);

  return (
    <Field id={inputId} label={label} error={error} hint={hint} aside={aside}>
      <div className="relative">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cx(inputClass(Boolean(error)), 'pe-16', className)}
          {...props}
          onKeyDown={(event) => {
            readCapsLock(event);
            onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            readCapsLock(event);
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-controls={inputId}
          aria-pressed={visible}
          disabled={props.disabled}
          className="absolute inset-y-0 end-0 flex items-center rounded-lg px-3 text-xs font-semibold text-slate-500 hover:text-navy focus:outline-none focus-visible:ring-2 focus-visible:ring-teal disabled:cursor-not-allowed disabled:opacity-60"
        >
          {visible ? hideLabel : showLabel}
        </button>
      </div>
      {capsLock && (
        <p role="status" className="mt-1.5 text-xs font-medium text-navy">
          {capsLockLabel}
        </p>
      )}
    </Field>
  );
});
