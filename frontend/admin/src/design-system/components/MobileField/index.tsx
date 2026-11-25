'use client';

import { forwardRef, useId, useMemo } from 'react';
import { countryOptions, type CountryCode } from '@/lib/phone';
import { phoneDigits } from '@/lib/validation';
import { cn as cx } from '../../utils/cn';
import { Field } from '../Field';
import { ListSelect } from '../ListSelect';

export type MobileFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
  /** Calling code country. India (IN) by default. */
  country?: string;
  /** Pass to let the customer pick another country from the list. */
  onCountryChange?: (country: CountryCode) => void;
  /** Language for country names in the list, e.g. "hi". */
  locale?: string;
  countryLabel?: string;
};

/**
 * Mobile number with its country code. India shows +91 and keeps 10 digits; other countries
 * use their own length. Spaces, dashes and a pasted country code are removed as you type.
 */
export const MobileField = forwardRef<HTMLInputElement, MobileFieldProps>(function MobileField(
  {
    label,
    error,
    hint,
    aside,
    id,
    className,
    onChange,
    country = 'IN',
    onCountryChange,
    locale = 'en',
    countryLabel = 'Country code',
    ...props
  },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const countries = useMemo(() => countryOptions(locale), [locale]);
  const current = countries.find((option) => option.code === country);
  const dial = current?.dialCode ?? '+91';
  const listOptions = useMemo(() => {
    const india = countries.filter((c) => c.code === 'IN');
    return [...india, ...countries.filter((c) => c.code !== 'IN')].map((c) => ({
      value: c.code,
      label: c.name,
      detail: c.dialCode,
      short: `${c.code} ${c.dialCode}`,
      keywords: c.dialCode.replace('+', ''),
    }));
  }, [countries]);

  return (
    <Field id={inputId} label={label} error={error} hint={hint} aside={aside}>
      {/* Phone numbers read left to right in every language. */}
      <div
        dir="ltr"
        className={cx(
          'flex h-11 w-full rounded-lg border bg-white shadow-sm transition focus-within:ring-4',
          error
            ? 'border-red-600 focus-within:ring-red-600/15'
            : 'border-slate-300 hover:border-slate-400 focus-within:border-teal focus-within:ring-teal/15',
          props.disabled && 'opacity-60',
        )}
      >
        {onCountryChange ? (
          <div className="flex shrink-0 items-center border-e border-slate-200 ps-1">
            <ListSelect
              label={countryLabel}
              hideLabel
              variant="compact"
              value={country}
              options={listOptions}
              searchable
              searchPlaceholder="Search country or code"
              onChange={(code) => onCountryChange(code as CountryCode)}
              disabled={props.disabled}
            />
          </div>
        ) : (
          <span
            className="flex shrink-0 items-center gap-1.5 border-e border-slate-200 ps-3 pe-3 text-sm text-navy"
            aria-hidden
          >
            <span className="font-medium">{country}</span>
            <span className="text-slate-500">{dial}</span>
          </span>
        )}
        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={cx(
            'h-full min-w-0 flex-1 rounded-e-lg bg-transparent px-3 text-sm tracking-wide text-navy outline-none placeholder:tracking-normal placeholder:text-slate-400',
            className,
          )}
          {...props}
          onChange={(event) => {
            const clean = phoneDigits(event.target.value, country, dial);
            if (clean !== event.target.value) event.target.value = clean;
            onChange?.(event);
          }}
        />
      </div>
    </Field>
  );
});
