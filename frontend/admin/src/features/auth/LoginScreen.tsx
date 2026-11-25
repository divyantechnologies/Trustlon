'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { BrandLogo } from '@/components/BrandLogo';
import { Btn } from '@/components/ui';
import { Alert, Button, PasswordField, TextField, focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { ApiError } from '@/lib/http';
import { qrPath } from '@/lib/qr';
import { authApi, type Challenge, type StaffSession } from './api';
import { useAuth } from './auth-provider';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

const message = (error: unknown, fallback = 'Something went wrong. Please try again.') =>
  error instanceof ApiError && error.message ? error.message : fallback;

function safeNext(value: string | null): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/login')
    ? value
    : '/';
}

function CodeInput({
  value,
  onChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
    <TextField
      label="6-digit code"
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9]*"
      maxLength={7}
      autoFocus={autoFocus}
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, '').slice(0, 6))}
      className="text-center font-mono text-lg tracking-[0.4em]"
    />
  );
}

function QrCode({ text }: { text: string }) {
  const qr = useMemo(() => qrPath(text), [text]);
  return (
    <svg
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      role="img"
      aria-label="QR code for your authenticator app"
      className="h-44 w-44 rounded-lg border border-slate-200 bg-white"
      shapeRendering="crispEdges"
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={qr.path} fill="#000" />
    </svg>
  );
}

/** Admin sign-in: password, then the authenticator app (set up on first sign-in). */
export function LoginScreen() {
  const { status, startSession } = useAuth();
  const router = useRouter();
  const next = safeNext(useSearchParams().get('next'));
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [pending, setPending] = useState<StaffSession | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'authenticated' && !recoveryCodes) router.replace(next);
  }, [status, next, router, recoveryCodes]);

  useEffect(() => {
    if (challenge?.step !== 'enroll' || setup) return;
    authApi
      .setup(challenge.challengeToken)
      .then(setSetup)
      .catch((err) => setError(message(err)));
  }, [challenge, setup]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      const text = message(err);
      setError(text);
      if (err instanceof ApiError && err.status === 401 && challenge) {
        // The sign-in expired: start again.
        setChallenge(null);
        setSetup(null);
      }
    } finally {
      setBusy(false);
    }
  };

  const title = recoveryCodes
    ? 'Save your recovery codes'
    : !challenge
      ? 'Sign in to Trustlon Admin'
      : challenge.step === 'password'
        ? 'Choose your own password'
        : challenge.step === 'enroll'
          ? 'Set up two-factor authentication'
          : 'Enter your authentication code';

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <BrandLogo href="/login" />
          <span className="rounded-full bg-navy px-2.5 py-0.5 text-xs font-semibold text-white">
            Admin
          </span>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="text-xl font-semibold text-navy">{title}</h1>
          {error && (
            <div className="mt-4">
              <Alert>{error}</Alert>
            </div>
          )}

          {recoveryCodes ? (
            <div className="mt-4 space-y-4">
              <p className="text-sm text-slate-600">
                If you lose your phone, each of these codes signs you in once. Keep them somewhere
                safe, like a password manager. They won’t be shown again.
              </p>
              <ul className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-4 font-mono text-sm text-navy">
                {recoveryCodes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="flex flex-wrap gap-2">
                <Btn
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(recoveryCodes.join('\n'))}
                >
                  Copy codes
                </Btn>
                <Btn
                  size="sm"
                  onClick={() => {
                    const blob = new Blob(
                      [
                        `Trustlon Admin recovery codes for ${challenge?.email ?? ''}\n\n${recoveryCodes.join('\n')}\n`,
                      ],
                      { type: 'text/plain' },
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'trustlon-admin-recovery-codes.txt';
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  Download
                </Btn>
              </div>
              <Button
                type="button"
                loading={busy}
                onClick={() =>
                  void run(async () => {
                    if (pending) await startSession(pending);
                    setRecoveryCodes(null);
                    router.replace(next);
                  })
                }
              >
                I’ve saved them, continue
              </Button>
            </div>
          ) : !challenge ? (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => setChallenge(await authApi.login(email.trim(), password)));
              }}
            >
              <p className="text-sm text-slate-600">
                For Trustlon staff. Customers and sellers sign in on their own sites.
              </p>
              <TextField
                label="Work email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <PasswordField
                label="Password"
                autoComplete="current-password"
                required
                showLabel="Show"
                hideLabel="Hide"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button type="submit" loading={busy} disabled={!email || !password}>
                Continue
              </Button>
            </form>
          ) : challenge.step === 'password' ? (
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (!PASSWORD_RULE.test(newPassword))
                  return setError(
                    'Use 8+ characters with an uppercase letter, a lowercase letter and a number.',
                  );
                if (newPassword !== confirm) return setError('The passwords don’t match.');
                void run(async () =>
                  setChallenge(await authApi.setPassword(challenge.challengeToken, newPassword)),
                );
              }}
            >
              <p className="text-sm text-slate-600">
                You signed in with a temporary password. Choose a new one only you know.
              </p>
              <PasswordField
                label="New password"
                autoComplete="new-password"
                showLabel="Show"
                hideLabel="Hide"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                hint="8+ characters, with an uppercase letter, a lowercase letter and a number."
              />
              <PasswordField
                label="Confirm new password"
                autoComplete="new-password"
                showLabel="Show"
                hideLabel="Hide"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
              <Button type="submit" loading={busy}>
                Save and continue
              </Button>
            </form>
          ) : challenge.step === 'enroll' ? (
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const session = await authApi.enroll(challenge.challengeToken, code);
                  setPending(session);
                  setRecoveryCodes(session.recoveryCodes);
                });
              }}
            >
              <ol className="list-decimal space-y-1 ps-5 text-sm text-slate-600">
                <li>
                  Install an authenticator app (Google Authenticator, Microsoft Authenticator,
                  1Password…).
                </li>
                <li>Scan this QR code, or enter the key by hand.</li>
                <li>Type the 6-digit code the app shows.</li>
              </ol>
              {setup ? (
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                  <QrCode text={setup.otpauthUri} />
                  <div className="min-w-0 text-sm">
                    <p className="text-xs text-slate-500">Key</p>
                    <p className="break-all font-mono text-navy">
                      {setup.secret.match(/.{1,4}/g)?.join(' ')}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Btn
                        size="sm"
                        onClick={() => void navigator.clipboard?.writeText(setup.secret)}
                      >
                        Copy key
                      </Btn>
                      <a
                        href={setup.otpauthUri}
                        className={cn(
                          'inline-flex h-9 items-center rounded-lg px-3 text-xs font-semibold text-teal-600 hover:underline sm:hidden',
                          focusRing,
                        )}
                      >
                        Open in app
                      </a>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Preparing your key…</p>
              )}
              <CodeInput value={code} onChange={setCode} />
              <Button type="submit" loading={busy} disabled={code.length !== 6 || !setup}>
                Turn on and sign in
              </Button>
            </form>
          ) : (
            <form
              className="mt-4 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void run(async () => {
                  const session = await authApi.verify(
                    challenge.challengeToken,
                    useRecovery ? { recoveryCode } : { code },
                  );
                  await startSession(session);
                  router.replace(next);
                });
              }}
            >
              {useRecovery ? (
                <TextField
                  label="Recovery code"
                  placeholder="ABCD-EFGH"
                  autoComplete="off"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                />
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    Open your authenticator app and enter the code for Trustlon Admin (
                    {challenge.email}).
                  </p>
                  <CodeInput value={code} onChange={setCode} autoFocus />
                </>
              )}
              <Button
                type="submit"
                loading={busy}
                disabled={
                  useRecovery ? recoveryCode.replace('-', '').length !== 8 : code.length !== 6
                }
              >
                Sign in
              </Button>
              <button
                type="button"
                onClick={() => setUseRecovery((v) => !v)}
                className={cn(
                  'w-full rounded text-center text-sm text-teal-600 hover:underline',
                  focusRing,
                )}
              >
                {useRecovery
                  ? 'Use the authenticator app instead'
                  : 'Lost your phone? Use a recovery code'}
              </button>
            </form>
          )}

          {challenge && !recoveryCodes && (
            <button
              type="button"
              onClick={() => {
                setChallenge(null);
                setSetup(null);
                setCode('');
                setError(null);
              }}
              className={cn(
                'mt-4 w-full rounded text-center text-sm text-slate-500 hover:text-navy',
                focusRing,
              )}
            >
              Start again
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">
          Every action in the admin panel is recorded in the audit log.
        </p>
      </div>
    </main>
  );
}
