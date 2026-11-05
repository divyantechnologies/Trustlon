'use client';

import { useEffect } from 'react';
import type { FieldErrors, UseFormReturn } from 'react-hook-form';
import { Button, PhoneField, TextField } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { detectCountry, isCountryCode, DEFAULT_COUNTRY } from '@/lib/phone';
import type { IdentifierValues } from '../schemas';

type IdentifierFormValues = IdentifierValues & Record<string, unknown>;

export const identifierDefaults: IdentifierValues = {
  mode: 'email',
  email: '',
  phoneCountry: DEFAULT_COUNTRY,
  phoneNational: '',
};

/** Email field with a switch to a mobile number field (with country code). */
export function IdentifierField<T extends IdentifierFormValues>({ form }: { form: UseFormReturn<T> }) {
  const { t, language } = useI18n();
  // The form's own value type is wider than IdentifierValues; work against the shared fields only.
  const f = form as unknown as UseFormReturn<IdentifierValues>;
  const errors = f.formState.errors as FieldErrors<IdentifierValues>;
  const mode = f.watch('mode');
  const country = f.watch('phoneCountry');

  useEffect(() => {
    if (!f.getValues('phoneNational')) f.setValue('phoneCountry', detectCountry());
  }, [f]);

  const switchMode = () => {
    f.clearErrors();
    f.setValue('mode', mode === 'email' ? 'phone' : 'email');
  };

  const switcher = (
    <Button type="button" variant="link" className="text-xs" onClick={switchMode}>
      {mode === 'email' ? t.identifier.useMobile : t.identifier.useEmail}
    </Button>
  );

  if (mode === 'phone') {
    return (
      <PhoneField
        key="phone"
        label={t.fields.mobile}
        countryLabel={t.fields.country}
        locale={language}
        country={isCountryCode(country) ? country : DEFAULT_COUNTRY}
        onCountryChange={(next) => f.setValue('phoneCountry', next)}
        placeholder={t.placeholders.mobile}
        autoFocus
        error={errors.phoneNational?.message}
        aside={switcher}
        {...f.register('phoneNational')}
      />
    );
  }

  return (
    <TextField
      key="email"
      label={t.fields.email}
      type="email"
      autoComplete="username"
      placeholder={t.placeholders.email}
      error={errors.email?.message}
      aside={switcher}
      {...f.register('email')}
    />
  );
}
