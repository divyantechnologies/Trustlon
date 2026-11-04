'use client';

import Link from 'next/link';
import { useAuth } from '@/features/auth';
import { useI18n } from '@/lib/i18n/language-provider';

// Placeholder until the Home page (spec section 2.1) is built. Used to check the session.
export default function HomePage() {
  const { status, user, logout } = useAuth();
  const { t, format } = useI18n();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <span className="text-2xl font-bold">
        Trustlon<span className="text-teal">.</span>
      </span>
      {status === 'authenticated' && user ? (
        <>
          <p>{format(t.home.welcome, { name: user.fullName })}</p>
          <button onClick={() => void logout()} className="text-sm font-semibold text-teal-600 hover:underline">
            {t.home.logout}
          </button>
        </>
      ) : status === 'guest' ? (
        <>
          <p className="text-slate-500">{t.home.guest}</p>
          <div className="flex gap-4 text-sm font-semibold text-teal-600">
            <Link href="/login">{t.signup.signIn}</Link>
            <Link href="/signup">{t.login.createAccount}</Link>
          </div>
        </>
      ) : null}
    </main>
  );
}
