'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { useI18n } from '@/lib/i18n/language-provider';
import { useAuth } from './auth-provider';
import { AuthHeading } from './components/AuthShell';
import { LoginForm } from './components/LoginForm';
import { ResetStepper } from './components/ResetStepper';
import { SignupForm } from './components/SignupForm';
import { safeNextPath } from './schemas';

/** Signed-in users who open an auth page are sent on to where they were going. */
function useRedirectIfAuthenticated() {
  const { status } = useAuth();
  const router = useRouter();
  const next = safeNextPath(useSearchParams().get('next'));
  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, next, router]);
}

function withNext(path: string, next: string | null) {
  return next ? `${path}?next=${encodeURIComponent(next)}` : path;
}

function SwitchLink({ prompt, label, href }: { prompt: string; label: string; href: string }) {
  return (
    <p className="mt-8 text-center text-sm text-slate-500">
      {prompt}{' '}
      <Link href={href} className="font-semibold text-teal-600 hover:underline">
        {label}
      </Link>
    </p>
  );
}

export function SignupScreen() {
  const { t } = useI18n();
  const next = useSearchParams().get('next');
  useRedirectIfAuthenticated();

  return (
    <>
      <AuthHeading title={t.signup.title} subtitle={t.signup.subtitle} />
      <SignupForm />
      <SwitchLink prompt={t.signup.haveAccount} label={t.signup.signIn} href={withNext('/login', next)} />
    </>
  );
}

export function LoginScreen() {
  const { t } = useI18n();
  const next = useSearchParams().get('next');
  useRedirectIfAuthenticated();

  return (
    <>
      <AuthHeading title={t.login.title} subtitle={t.login.subtitle} />
      <LoginForm />
      <SwitchLink prompt={t.login.newHere} label={t.login.createAccount} href={withNext('/signup', next)} />
    </>
  );
}

export function ForgotPasswordScreen() {
  const { t } = useI18n();

  return (
    <>
      <AuthHeading title={t.reset.title} subtitle={t.reset.subtitle} />
      <ResetStepper />
      <p className="mt-8 text-center text-sm">
        <Link href="/login" className="font-semibold text-teal-600 hover:underline">
          {t.reset.backToLogin}
        </Link>
      </p>
    </>
  );
}
