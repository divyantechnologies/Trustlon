'use client';

import { forwardRef, useId } from 'react';
import { cn as cx } from '../../utils/cn';
import { Field } from '../Field';
import { inputClass } from '../../styles';

export type TextFieldProps = React.InputHTMLAttributes<HTMLInputElement> & {
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
