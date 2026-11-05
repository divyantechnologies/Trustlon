'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { layouts, Alert, Button, PasswordField } from '@/design-system';
import { useI18n } from '@/lib/i18n/language-provider';
import { authApi, type SessionResponse } from '../api';
import { readGuestCartToken, useAuth } from '../auth-provider';
import {
  identifierSchema,
  identifierValue,
  passwordLoginSchema,
  safeNextPath,
  type IdentifierValues,
  type PasswordLoginValues,
} from '../schemas';
import { useApiError } from '../use-api-error';
import { IdentifierField, identifierDefaults } from './IdentifierField';
import { OtpInput } from './OtpInput';

type Tab = 'password' | 'otp';

function useCompleteLogin() {
  const { startSession } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  return (session: SessionResponse) => {
    startSession(session);
    router.replace(next);
  };
}

function LoginTabs({ value, onChange }: { value: Tab; onChange: (tab: Tab) => void }) {
  const { t } = useI18n();
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'password', label: t.login.tabPassword },
    { id: 'otp', label: t.login.tabOtp },
  ];
  return (
    <div role="tablist" className="mb-6 grid grid-cols-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={`h-11 rounded-lg text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal ${
            value === tab.id
              ? 'bg-white text-teal-600 shadow-sm ring-1 ring-teal/30'
              : 'text-slate-500 hover:text-navy'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function PasswordLoginForm() {
  const { t } = useI18n();
  const completeLogin = useCompleteLogin();
  const [busy, setBusy] = useState(false);
  const { error, capture, clear } = useApiError();

  const schema = useMemo(() => passwordLoginSchema(t), [t]);
  const form = useForm<PasswordLoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { ...identifierDefaults, password: '' },
  });

  const submit = form.handleSubmit(async (values) => {
    clear();
    setBusy(true);
    try {
      completeLogin(
        await authApi.login(identifierValue(values), values.password, readGuestCartToken()),
      );
    } catch (caught) {
      capture(caught);
      setBusy(false);
    }
  });

  return (
    <form noValidate onSubmit={submit} className={layouts.form}>
      {error && <Alert>{error.message}</Alert>}
      <IdentifierField form={form} />
      <PasswordField
        label={t.fields.password}
        autoComplete="current-password"
        showLabel={t.common.show}
        hideLabel={t.common.hide}
        error={form.formState.errors.password?.message}
        aside={
          <Link href="/forgot-password" className="text-xs font-medium text-teal-600 hover:underline">
            {t.login.forgot}
          </Link>
        }
        {...form.register('password')}
      />
      <Button type="submit" loading={busy}>
        {busy ? t.common.pleaseWait : t.login.submit}
      </Button>
    </form>
  );
}

function OtpLoginForm() {
  const { t } = useI18n();
  const completeLogin = useCompleteLogin();
  const [target, setTarget] = useState<{ value: string; channel: 'email' | 'mobile' } | null>(null);
  const [resendAfter, setResendAfter] = useState(30);
  const [busy, setBusy] = useState(false);
  const { error, capture, clear } = useApiError();

  const schema = useMemo(() => identifierSchema(t), [t]);
  const form = useForm<IdentifierValues>({
    resolver: zodResolver(schema),
    defaultValues: identifierDefaults,
  });

  const send = form.handleSubmit(async (values) => {
    clear();
    setBusy(true);
    const value = identifierValue(values);
    try {
      const result = await authApi.sendOtp(value, 'LOGIN');
      setResendAfter(result.resendAfterSeconds);
      setTarget({ value, channel: values.mode === 'email' ? 'email' : 'mobile' });
    } catch (caught) {
      capture(caught);
    } finally {
      setBusy(false);
    }
  });

  if (target) {
    return (
      <OtpInput
        channel={target.channel}
        target={target.value}
        resendAfterSeconds={resendAfter}
        onResend={async () => {
          clear();
          try {
            return (await authApi.sendOtp(target.value, 'LOGIN')).resendAfterSeconds;
          } catch (caught) {
            capture(caught);
          }
        }}
        onSubmit={async (code) => {
          clear();
          setBusy(true);
          try {
            completeLogin(await authApi.verifyLogin(target.value, code, readGuestCartToken()));
          } catch (caught) {
            capture(caught);
            setBusy(false);
          }
        }}
        onChangeTarget={() => {
          clear();
          setTarget(null);
        }}
        submitLabel={t.login.verifyAndLogin}
        error={error?.message}
        attemptsLeft={error?.attemptsLeft}
        loading={busy}
      />
    );
  }

  return (
    <form noValidate onSubmit={send} className={layouts.form}>
      {error && <Alert>{error.message}</Alert>}
      <IdentifierField form={form} />
      <Button type="submit" loading={busy}>
        {busy ? t.common.sending : t.login.sendCode}
      </Button>
    </form>
  );
}

export function LoginForm() {
  const { t } = useI18n();
  const params = useSearchParams();
  const [tab, setTab] = useState<Tab>('password');
  const fromCheckout = safeNextPath(params.get('next')).startsWith('/checkout');

  return (
    <div>
      {params.get('reset') === '1' && (
        <div className="mb-5">
          <Alert tone="success">{t.login.resetDone}</Alert>
        </div>
      )}
      {fromCheckout && (
        <div className="mb-5">
          <Alert tone="info">{t.login.guestCheckout}</Alert>
        </div>
      )}
      <LoginTabs value={tab} onChange={setTab} />
      {tab === 'password' ? <PasswordLoginForm /> : <OtpLoginForm />}
    </div>
  );
}
