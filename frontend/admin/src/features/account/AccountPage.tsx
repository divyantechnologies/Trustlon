'use client';

import { useState } from 'react';
import { Badge, Btn, Card, KeyValues, PageHeader, useAction } from '@/components/ui';
import { PasswordField, TextField } from '@/design-system';
import { useAuth } from '@/features/auth/auth-provider';
import { authApi } from '@/features/auth/api';
import { humanize } from '@/lib/format';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,72}$/;

/** My account: profile, password and two-step sign-in recovery codes. */
export function AccountPage() {
  const { profile, reloadProfile } = useAuth();
  const run = useAction();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState<string[] | null>(null);
  const [making, setMaking] = useState(false);

  if (!profile) return null;

  return (
    <div>
      <PageHeader title="My account" description="Your staff profile and sign-in security." />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Profile">
          <KeyValues
            columns={1}
            items={[
              ['Name', profile.user.fullName],
              ['Email', profile.user.email],
              ['Mobile', profile.user.mobile],
              ['Role', humanize(profile.user.role)],
              ['Panels', profile.user.panels.map(humanize).join(', ')],
            ]}
          />
          <p className="mt-3 text-xs text-slate-500">
            Ask a Super Admin to change your name, email or role.
          </p>
        </Card>

        <Card title="Change password">
          <form
            className="space-y-4"
            noValidate
            onSubmit={async (event) => {
              event.preventDefault();
              if (!PASSWORD_RULE.test(next))
                return setPwError(
                  'Use 8+ characters with an uppercase letter, a lowercase letter and a number.',
                );
              if (next !== confirm) return setPwError('The new passwords don’t match.');
              setPwError(null);
              setSaving(true);
              const ok = await run(
                () => authApi.changePassword(current, next).then(() => true),
                'Password changed. Other sessions were signed out.',
              );
              setSaving(false);
              if (ok) {
                setCurrent('');
                setNext('');
                setConfirm('');
              }
            }}
          >
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              showLabel="Show"
              hideLabel="Hide"
            />
            <PasswordField
              label="New password"
              autoComplete="new-password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              showLabel="Show"
              hideLabel="Hide"
              hint="8+ characters with upper and lower case letters and a number."
            />
            <PasswordField
              label="Confirm new password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              showLabel="Show"
              hideLabel="Hide"
              error={pwError ?? undefined}
            />
            <Btn type="submit" tone="primary" loading={saving} disabled={!current || !next}>
              Change password
            </Btn>
          </form>
        </Card>

        <Card
          title="Two-step sign-in"
          actions={
            <Badge tone={profile.twoFactor.enabled ? 'success' : 'warning'}>
              {profile.twoFactor.enabled ? 'On' : 'Off'}
            </Badge>
          }
        >
          <p className="text-sm text-slate-600">
            You have <strong>{profile.twoFactor.recoveryCodesLeft}</strong> unused recovery codes.
            Each works once if you lose your phone.
          </p>
          {codes ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-navy">
                New recovery codes (old ones no longer work). Save them somewhere safe:
              </p>
              <ul className="mt-2 grid grid-cols-2 gap-2 rounded-lg bg-navy-50 p-3 font-mono text-sm text-navy">
                {codes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <Btn
                  size="sm"
                  onClick={() => void navigator.clipboard?.writeText(codes.join('\n'))}
                >
                  Copy all
                </Btn>
                <Btn size="sm" tone="ghost" onClick={() => setCodes(null)}>
                  Done
                </Btn>
              </div>
            </div>
          ) : (
            <form
              className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
              onSubmit={async (event) => {
                event.preventDefault();
                setMaking(true);
                const result = await run(() => authApi.newRecoveryCodes(code));
                setMaking(false);
                if (result) {
                  setCodes(result.recoveryCodes);
                  setCode('');
                  await reloadProfile();
                }
              }}
            >
              <TextField
                label="Code from your authenticator app"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={7}
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Btn type="submit" loading={making} disabled={!/^\d{3}\s?\d{3}$/.test(code.trim())}>
                Make new recovery codes
              </Btn>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
