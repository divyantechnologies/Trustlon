'use client';

import { forwardRef, useEffect, useId, useMemo, useState } from 'react';
import { countryOptions, type CountryCode } from '@/lib/phone';
import { cx, Field } from './primitives';

type PhoneFieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  label: string;
  countryLabel: string;
  country: CountryCode;
  onCountryChange: (country: CountryCode) => void;
  locale: string;
  error?: string;
  hint?: React.ReactNode;
  aside?: React.ReactNode;
};

/** Country calling-code picker plus national number input, rendered as one control. */
export const PhoneField = forwardRef<HTMLInputElement, PhoneFieldProps>(function PhoneField(
  { label, countryLabel, country, onCountryChange, locale, error, hint, aside, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const options = useMemo(() => countryOptions(locale), [locale]);
  // Country names come from the browser's language data, which can differ from the server's.
  // Show only the selected country until the page is interactive, then the full list.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const visibleOptions = ready ? options : options.filter((option) => option.code === country);
  const selected = options.find((option) => option.code === country);

  return (
    <Field id={inputId} label={label} error={error} hint={hint} aside={aside}>
      <div
        dir="ltr"
        className={cx(
          'flex h-11 w-full rounded-lg border bg-white shadow-sm transition focus-within:ring-4',
          error
            ? 'border-red-500 focus-within:ring-red-500/15'
            : 'border-slate-300 hover:border-slate-400 focus-within:border-teal focus-within:ring-teal/15',
        )}
      >
        <div className="relative flex shrink-0 items-center gap-1.5 border-e border-slate-200 ps-3 pe-2 text-sm text-navy">
          <span className="font-medium">{country}</span>
          <span className="text-slate-500">{selected?.dialCode}</span>
          <svg aria-hidden viewBox="0 0 12 12" className="h-3 w-3 fill-slate-400">
            <path d="M2.2 4.2a.75.75 0 0 1 1.06 0L6 6.94l2.74-2.74a.75.75 0 1 1 1.06 1.06L6.53 8.53a.75.75 0 0 1-1.06 0L2.2 5.26a.75.75 0 0 1 0-1.06Z" />
          </svg>
          <select
            aria-label={countryLabel}
            value={country}
            onChange={(event) => onCountryChange(event.target.value as CountryCode)}
            className="absolute inset-0 cursor-pointer opacity-0"
          >
            {visibleOptions.map((option) => (
              <option key={option.code} value={option.code} suppressHydrationWarning>
                {option.name} ({option.dialCode})
              </option>
            ))}
          </select>
        </div>
        <input
          ref={ref}
          id={inputId}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className="h-full min-w-0 flex-1 rounded-e-lg bg-transparent px-3 text-sm text-navy outline-none placeholder:text-slate-400"
          {...props}
        />
      </div>
    </Field>
  );
});
