'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  cn,
  Dialog,
  focusRing,
  PasswordField,
  ListSelect,
  MobileField,
  TextField,
} from '@/design-system';
import { LanguagePicker } from '@/components/LanguagePicker';
import { useAuth } from '@/features/auth';
import { OtpInput } from '@/features/auth/components/OtpInput';
import { PasswordRequirements } from '@/features/auth/components/PasswordRequirements';
import { meetsPasswordRules } from '@/features/auth/schemas';
import { ApiError } from '@/lib/http';
import { useSiteConfig } from '@/lib/site-config';
import {
  fromApiLanguage,
  toApiLanguage,
  useI18n,
  type Language,
} from '@/lib/i18n/language-provider';
import { DEFAULT_COUNTRY, formatInternational, type CountryCode } from '@/lib/phone';
import { isValidEmail, isValidName, suggestEmail, toMobileE164 } from '@/lib/validation';
import { accountApi } from './api';
import { EmptyState, PageHeader, Panel, secondaryAction, Skeleton } from './components/ui';
import { formatDate, formatDateTime, formatMoney } from './format';
import type {
  ActiveSession,
  Gender,
  NotificationChannel,
  NotificationChoices,
  NotificationEvent,
  SettingsOverview,
  SettingsProfile,
} from './types';

const SECTIONS = [
  ['profile', 'Profile'],
  ['contact', 'Email and mobile'],
  ['security', 'Security'],
  ['notifications', 'Notifications'],
  ['language', 'Language'],
  ['privacy', 'Privacy'],
] as const;

const GENDERS: Array<{ value: Gender; label: string }> = [
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
  { value: 'OTHER', label: 'Other' },
  { value: 'PREFER_NOT_TO_SAY', label: 'Prefer not to say' },
];

const EVENTS: Array<{ key: NotificationEvent; label: string; description: string }> = [
  {
    key: 'orders',
    label: 'Order updates',
    description: 'Confirmation, invoices and cancellations',
  },
  {
    key: 'delivery',
    label: 'Shipping and delivery',
    description: 'Dispatch, out for delivery, delivered',
  },
  { key: 'returns', label: 'Returns and refunds', description: 'Pickup slots and refund status' },
  {
    key: 'priceAlerts',
    label: 'Price drop alerts',
    description: 'When a product hits your target price',
  },
  {
    key: 'offers',
    label: 'Offers and recommendations',
    description: 'Deals and picks we think you’ll like',
  },
  {
    key: 'account',
    label: 'Account and security',
    description: 'Sign-in codes, password changes. Always sent by SMS and email.',
  },
];

const CHANNELS: Array<{ key: NotificationChannel; label: string }> = [
  { key: 'sms', label: 'SMS' },
  { key: 'email', label: 'Email' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'push', label: 'App' },
];

const errorText = (error: unknown, fallback: string) =>
  error instanceof ApiError && error.message ? error.message : fallback;

function Verified({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-xs font-semibold',
        ok ? 'bg-teal-50 text-teal-600' : 'bg-slate-100 text-slate-500',
      )}
    >
      {ok ? 'Verified' : 'Not verified'}
    </span>
  );
}

/** The latest date of birth that makes someone 13 today, as YYYY-MM-DD. */
function maxBirthDate(): string {
  const date = new Date();
  date.setFullYear(date.getFullYear() - 13);
  return date.toISOString().slice(0, 10);
}

/* Profile */

function ProfileForm({
  profile,
  onSaved,
}: {
  profile: SettingsProfile;
  onSaved: (profile: SettingsProfile) => void;
}) {
  const { updateUser } = useAuth();
  const [fullName, setFullName] = useState(profile.fullName);
  const [dateOfBirth, setDateOfBirth] = useState(profile.dateOfBirth ?? '');
  const [gender, setGender] = useState<Gender | ''>(profile.gender ?? '');
  const [errors, setErrors] = useState<{ fullName?: string; dateOfBirth?: string }>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty =
    fullName.trim() !== profile.fullName ||
    dateOfBirth !== (profile.dateOfBirth ?? '') ||
    gender !== (profile.gender ?? '');

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    const name = fullName.trim();
    if (!isValidName(name)) {
      return setErrors({ fullName: 'Enter your full name using letters only' });
    }
    if (dateOfBirth && dateOfBirth > maxBirthDate()) {
      return setErrors({ dateOfBirth: 'You must be at least 13 years old' });
    }
    setErrors({});
    setSaving(true);
    try {
      const { profile: saved } = await accountApi.updateProfile({
        fullName: name,
        dateOfBirth: dateOfBirth || null,
        gender: gender || null,
      });
      updateUser({ fullName: saved.fullName });
      onSaved(saved);
      setStatus({ tone: 'success', text: 'Profile saved.' });
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.field === 'fullName' || error.field === 'dateOfBirth')
      ) {
        setErrors(
          error.field === 'fullName' ? { fullName: error.message } : { dateOfBirth: error.message },
        );
      } else {
        setStatus({
          tone: 'error',
          text: errorText(error, 'We couldn’t save your profile. Try again.'),
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <TextField
        label="Full name"
        autoComplete="name"
        maxLength={100}
        value={fullName}
        error={errors.fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <TextField
          label="Date of birth"
          type="date"
          max={maxBirthDate()}
          min="1900-01-01"
          value={dateOfBirth}
          error={errors.dateOfBirth}
          hint="Optional. We use it for birthday offers only."
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
        <ListSelect<Gender | 'NONE'>
          label="Gender"
          value={gender || 'NONE'}
          onChange={(next) => setGender(next === 'NONE' ? '' : next)}
          options={[{ value: 'NONE', label: 'Not set' }, ...GENDERS]}
        />
      </div>
      <div aria-live="polite">{status && <Alert tone={status.tone}>{status.text}</Alert>}</div>
      <div className="sm:w-48">
        <Button type="submit" loading={saving} disabled={!dirty}>
          Save profile
        </Button>
      </div>
    </form>
  );
}

/* Email and mobile */

function ContactDialog({
  type,
  profile,
  onClose,
  onSaved,
}: {
  type: 'email' | 'mobile';
  profile: SettingsProfile;
  onClose: () => void;
  onSaved: (profile: SettingsProfile) => void;
}) {
  const isEmail = type === 'email';
  const { language } = useI18n();
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(DEFAULT_COUNTRY);
  const [step, setStep] = useState<'enter' | 'code'>('enter');
  const [email, setEmail] = useState('');
  const [national, setNational] = useState('');
  const [password, setPassword] = useState('');
  const [target, setTarget] = useState('');
  const [resendAfter, setResendAfter] = useState(30);
  const [fieldErrors, setFieldErrors] = useState<{ value?: string; currentPassword?: string }>({});
  const [error, setError] = useState<{ message: string; attemptsLeft?: number } | null>(null);
  const [busy, setBusy] = useState(false);

  const suggestion = isEmail ? suggestEmail(email) : null;

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const value = isEmail ? email.trim().toLowerCase() : toMobileE164(national, phoneCountry);
    const errors: typeof fieldErrors = {};
    if (isEmail && !isValidEmail(value ?? '')) {
      errors.value = 'Enter a valid email address, e.g. name@example.com';
    }
    if (!isEmail && !value) {
      errors.value =
        phoneCountry === 'IN'
          ? 'Enter a valid 10-digit Indian mobile number'
          : 'Enter a valid mobile number for this country';
    }
    if (profile.hasPassword && !password) errors.currentPassword = 'Enter your current password';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0 || !value) return;
    setBusy(true);
    try {
      const sent = await accountApi.sendContactCode(type, value, password || undefined);
      setTarget(sent.target);
      setResendAfter(sent.resendAfterSeconds);
      setStep('code');
    } catch (caught) {
      if (
        caught instanceof ApiError &&
        (caught.field === 'value' || caught.field === 'currentPassword')
      ) {
        setFieldErrors(
          caught.field === 'value'
            ? { value: caught.message }
            : { currentPassword: caught.message },
        );
      } else {
        setError({ message: errorText(caught, 'We couldn’t send a code. Try again.') });
      }
    } finally {
      setBusy(false);
    }
  };

  const verify = async (code: string) => {
    setError(null);
    setBusy(true);
    try {
      const { profile: saved } = await accountApi.verifyContact(type, target, code);
      onSaved(saved);
    } catch (caught) {
      setError({
        message: errorText(caught, 'That code didn’t work. Try again.'),
        attemptsLeft: caught instanceof ApiError ? caught.attemptsLeft : undefined,
      });
      setBusy(false);
    }
  };

  const resend = async () => {
    setError(null);
    try {
      return (await accountApi.sendContactCode(type, target, password || undefined))
        .resendAfterSeconds;
    } catch (caught) {
      setError({ message: errorText(caught, 'We couldn’t send a new code.') });
    }
  };

  return (
    <Dialog
      open
      title={isEmail ? 'Change email address' : 'Change mobile number'}
      onClose={onClose}
    >
      {step === 'enter' ? (
        <form onSubmit={sendCode} noValidate className="space-y-5">
          <p className="text-sm text-slate-600">
            Current:{' '}
            <span className="font-medium text-navy">
              {isEmail ? profile.email : formatInternational(profile.mobile)}
            </span>
            . We’ll send a 6-digit code to the new {isEmail ? 'email address' : 'number'} to confirm
            it’s yours.
          </p>
          {isEmail ? (
            <TextField
              label="New email address"
              type="email"
              autoComplete="email"
              value={email}
              error={fieldErrors.value}
              hint={
                suggestion ? (
                  <span>
                    Did you mean{' '}
                    <button
                      type="button"
                      className="font-semibold text-teal-600 underline underline-offset-2"
                      onClick={() => setEmail(suggestion)}
                    >
                      {suggestion}
                    </button>
                    ?
                  </span>
                ) : undefined
              }
              onChange={(e) => setEmail(e.target.value)}
            />
          ) : (
            <MobileField
              label="New mobile number"
              country={phoneCountry}
              onCountryChange={setPhoneCountry}
              locale={language}
              placeholder="10-digit mobile number"
              value={national}
              error={fieldErrors.value}
              onChange={(e) => setNational(e.target.value)}
            />
          )}
          {profile.hasPassword && (
            <PasswordField
              label="Current password"
              autoComplete="current-password"
              showLabel="Show"
              hideLabel="Hide"
              value={password}
              error={fieldErrors.currentPassword}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          {error && <Alert>{error.message}</Alert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy}>
              Send code
            </Button>
          </div>
        </form>
      ) : (
        <OtpInput
          channel={type}
          target={target}
          resendAfterSeconds={resendAfter}
          onResend={resend}
          onSubmit={verify}
          onChangeTarget={() => {
            setError(null);
            setStep('enter');
          }}
          submitLabel={isEmail ? 'Verify and save email' : 'Verify and save number'}
          error={error?.message}
          attemptsLeft={error?.attemptsLeft}
          loading={busy}
        />
      )}
    </Dialog>
  );
}

function ContactSection({
  profile,
  onSaved,
}: {
  profile: SettingsProfile;
  onSaved: (profile: SettingsProfile) => void;
}) {
  const { updateUser } = useAuth();
  const [editing, setEditing] = useState<'email' | 'mobile' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const rows = [
    {
      type: 'email' as const,
      label: 'Email address',
      value: profile.email,
      verified: profile.emailVerified,
    },
    {
      type: 'mobile' as const,
      label: 'Mobile number',
      value: formatInternational(profile.mobile),
      verified: profile.mobileVerified,
    },
  ];
  return (
    <>
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>
      <ul className="divide-y divide-slate-100">
        {rows.map((row) => (
          <li
            key={row.type}
            className="flex flex-wrap items-center justify-between gap-3 py-4 first:pt-0 last:pb-0"
          >
            <div className="min-w-0">
              <p className="text-sm text-slate-500">{row.label}</p>
              <p className="mt-0.5 flex flex-wrap items-center gap-2 font-medium text-navy">
                <span className="break-all">{row.value}</span>
                <Verified ok={row.verified} />
              </p>
            </div>
            <button
              type="button"
              className={secondaryAction}
              onClick={() => {
                setNotice(null);
                setEditing(row.type);
              }}
            >
              Change
            </button>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-slate-500">
        You can sign in with either. Changing one needs your password and a code sent to the new
        address.
      </p>
      {editing && (
        <ContactDialog
          key={editing}
          type={editing}
          profile={profile}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            updateUser({
              email: saved.email,
              mobile: saved.mobile,
              emailVerified: saved.emailVerified,
              mobileVerified: saved.mobileVerified,
            });
            onSaved(saved);
            setNotice(
              editing === 'email'
                ? 'Your email address was updated.'
                : 'Your mobile number was updated.',
            );
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

/* Security */

function ChangePasswordForm({
  profile,
  onChanged,
}: {
  profile: SettingsProfile;
  onChanged: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [status, setStatus] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setStatus(null);
    const found: typeof errors = {};
    if (profile.hasPassword && !current) found.current = 'Enter your current password';
    if (!meetsPasswordRules(next)) found.next = 'Your new password doesn’t meet the rules below';
    if (confirm !== next) found.confirm = 'Passwords don’t match';
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      const result = await accountApi.changePassword(current || undefined, next);
      setCurrent('');
      setNext('');
      setConfirm('');
      setStatus({
        tone: 'success',
        text:
          result.signedOutSessions > 0
            ? `Password updated. We signed you out on ${result.signedOutSessions} other device${result.signedOutSessions > 1 ? 's' : ''}.`
            : 'Password updated.',
      });
      onChanged();
    } catch (error) {
      if (error instanceof ApiError && error.field === 'currentPassword') {
        setErrors({ current: error.message });
      } else if (error instanceof ApiError && error.field === 'newPassword') {
        setErrors({ next: error.message });
      } else {
        setStatus({ tone: 'error', text: errorText(error, 'We couldn’t update your password.') });
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      {profile.hasPassword && (
        <PasswordField
          label="Current password"
          autoComplete="current-password"
          showLabel="Show"
          hideLabel="Hide"
          value={current}
          error={errors.current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      )}
      <div className="space-y-2">
        <PasswordField
          label="New password"
          autoComplete="new-password"
          showLabel="Show"
          hideLabel="Hide"
          value={next}
          error={errors.next}
          onChange={(e) => setNext(e.target.value)}
        />
        <PasswordRequirements password={next} />
      </div>
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        showLabel="Show"
        hideLabel="Hide"
        value={confirm}
        error={errors.confirm}
        onChange={(e) => setConfirm(e.target.value)}
      />
      <div aria-live="polite">{status && <Alert tone={status.tone}>{status.text}</Alert>}</div>
      <div className="sm:w-56">
        <Button type="submit" loading={saving}>
          Update password
        </Button>
      </div>
      {profile.passwordChangedAt && (
        <p className="text-xs text-slate-500">
          Last changed {formatDate(profile.passwordChangedAt)}. Changing it signs you out on your
          other devices.
        </p>
      )}
    </form>
  );
}

function DeviceIcon({ mobile }: { mobile: boolean }) {
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy-50 text-navy">
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {mobile ? (
          <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2" />
        ) : (
          <path d="M4 5h16v10H4zM2 19h20M9 15v4m6-4v4" />
        )}
      </svg>
    </span>
  );
}

function SessionsList({ refreshKey }: { refreshKey: number }) {
  const [sessions, setSessions] = useState<ActiveSession[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  const load = () =>
    accountApi
      .sessions()
      .then((result) => {
        setSessions(result.items);
        setFailed(false);
      })
      .catch(() => setFailed(true));

  useEffect(() => {
    void load();
    // Reloads when the parent asks (after a password change signs other devices out).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  const revoke = async (id: string) => {
    setBusy(id);
    setNotice(null);
    try {
      await accountApi.revokeSession(id);
      setSessions((current) => current?.filter((s) => s.id !== id) ?? null);
      setNotice({ tone: 'success', text: 'That device has been signed out.' });
    } catch (error) {
      setNotice({ tone: 'error', text: errorText(error, 'We couldn’t sign out that device.') });
    } finally {
      setBusy(null);
    }
  };

  const revokeOthers = async () => {
    setBusy('others');
    setNotice(null);
    try {
      const { revoked } = await accountApi.revokeOtherSessions();
      await load();
      setNotice({
        tone: 'success',
        text: revoked
          ? `Signed out of ${revoked} other device${revoked > 1 ? 's' : ''}.`
          : 'No other devices were signed in.',
      });
    } catch (error) {
      setNotice({
        tone: 'error',
        text: errorText(error, 'We couldn’t sign out your other devices.'),
      });
    } finally {
      setBusy(null);
    }
  };

  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-navy">Where you’re signed in</h3>
        {others > 0 && (
          <Button
            type="button"
            variant="link"
            className="text-sm"
            loading={busy === 'others'}
            onClick={revokeOthers}
          >
            Sign out all other devices
          </Button>
        )}
      </div>
      <div aria-live="polite" className="mb-3 empty:hidden">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      </div>
      {failed && !sessions ? (
        <p role="alert" className="text-sm text-slate-500">
          We couldn’t load your devices.
        </p>
      ) : !sessions ? (
        <div className="space-y-2" aria-busy="true">
          <Skeleton className="h-16" />
          <Skeleton className="h-16" />
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {sessions.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-3 p-4">
              <DeviceIcon mobile={session.mobile} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 font-medium text-navy">
                  {session.browser} on {session.os}
                  {session.current && (
                    <span className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-600">
                      This device
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {session.current
                    ? 'Active now'
                    : `Last active ${formatDateTime(session.lastActiveAt)}`}
                  {session.ip ? ` · IP ${session.ip}` : ''} · Signed in{' '}
                  {formatDate(session.signedInAt)}
                </p>
              </div>
              {!session.current && (
                <button
                  type="button"
                  className={secondaryAction}
                  disabled={busy === session.id}
                  onClick={() => revoke(session.id)}
                >
                  {busy === session.id ? 'Signing out…' : 'Sign out'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Don’t recognise a device? Sign it out and change your password.
      </p>
    </div>
  );
}

/* Notifications */

function NotificationPreferences({
  initial,
  locked,
}: {
  initial: NotificationChoices;
  locked: NotificationEvent[];
}) {
  const [choices, setChoices] = useState(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const toggle = async (event: NotificationEvent, channel: NotificationChannel) => {
    const previous = choices;
    const next = {
      ...choices,
      [event]: { ...choices[event], [channel]: !choices[event][channel] },
    };
    setChoices(next);
    setStatus('saving');
    try {
      const saved = await accountApi.updateNotifications({ [event]: next[event] });
      setChoices(saved.channels);
      setStatus('saved');
    } catch {
      setChoices(previous);
      setStatus('error');
    }
  };

  const isLocked = (event: NotificationEvent, channel: NotificationChannel) =>
    locked.includes(event) && (channel === 'sms' || channel === 'email');

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-start text-sm">
          <caption className="sr-only">Choose how we contact you for each kind of message</caption>
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="py-2 pe-4 font-medium">
                Message
              </th>
              {CHANNELS.map((channel) => (
                <th
                  key={channel.key}
                  scope="col"
                  className="w-20 px-2 py-2 text-center font-medium"
                >
                  {channel.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {EVENTS.map((event) => (
              <tr key={event.key}>
                <th scope="row" className="py-3 pe-4 font-normal">
                  <span className="block font-medium text-navy">{event.label}</span>
                  <span className="block text-xs text-slate-500">{event.description}</span>
                </th>
                {CHANNELS.map((channel) => {
                  const on = choices[event.key][channel.key];
                  const disabled = isLocked(event.key, channel.key);
                  return (
                    <td key={channel.key} className="px-2 py-3 text-center">
                      <button
                        type="button"
                        role="switch"
                        aria-checked={on}
                        aria-label={`${event.label} by ${channel.label}`}
                        disabled={disabled}
                        onClick={() => toggle(event.key, channel.key)}
                        className={cn(
                          'relative inline-flex h-6 w-10 items-center rounded-full transition disabled:cursor-not-allowed disabled:opacity-60',
                          focusRing,
                          on ? 'bg-teal' : 'bg-slate-300',
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            'inline-block h-5 w-5 rounded-full bg-white shadow-sm transition',
                            on
                              ? 'translate-x-[18px] rtl:-translate-x-[18px]'
                              : 'translate-x-0.5 rtl:-translate-x-0.5',
                          )}
                        />
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p aria-live="polite" className="mt-3 min-h-5 text-xs">
        {status === 'saving' && <span className="text-slate-500">Saving…</span>}
        {status === 'saved' && <span className="text-teal-600">Preferences saved.</span>}
        {status === 'error' && (
          <span className="text-red-600">We couldn’t save that change. Try again.</span>
        )}
      </p>
    </div>
  );
}

/* Language */

function LanguageSelector({
  profile,
  onSaved,
}: {
  profile: SettingsProfile;
  onSaved: (profile: SettingsProfile) => void;
}) {
  const { language } = useI18n();
  const { updateUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const preferred: Language = fromApiLanguage(profile.preferredLanguage);

  const choose = async (value: Language) => {
    setError(null);
    setSaved(false);
    try {
      const { profile: next } = await accountApi.updateProfile({
        preferredLanguage: toApiLanguage(value),
      });
      updateUser({ preferredLanguage: next.preferredLanguage });
      onSaved(next);
      setSaved(true);
    } catch {
      setError('We couldn’t save your language. It still applies on this device.');
    }
  };

  return (
    <div className="max-w-md">
      <LanguagePicker
        variant="field"
        label="Preferred language"
        value={preferred}
        onChange={choose}
        align="start"
        hint={
          <>
            Used for messages, invoices and the site when you sign in.
            {language !== preferred && ' This device is showing a different language right now.'}
          </>
        }
      />
      <p aria-live="polite" className="mt-2 min-h-5 text-xs">
        {saved && <span className="text-teal-600">Language saved.</span>}
        {error && <span className="text-red-600">{error}</span>}
      </p>
    </div>
  );
}

/* Privacy */

function DeleteAccountDialog({
  overview,
  onClose,
}: {
  overview: SettingsOverview;
  onClose: () => void;
}) {
  const router = useRouter();
  const { endSession } = useAuth();
  const { deletion, profile } = overview;
  const [reason, setReason] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const blocked = deletion.blockers.length > 0;
  // Reasons are edited in Admin › Settings › Features.
  const deleteReasons = useSiteConfig().config.account.deleteReasons;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPasswordError(undefined);
    if (profile.hasPassword && !password) return setPasswordError('Enter your password');
    setBusy(true);
    try {
      await accountApi.deleteAccount({
        confirm,
        currentPassword: password || undefined,
        reason: reason || undefined,
      });
      endSession();
      router.replace('/');
    } catch (caught) {
      if (caught instanceof ApiError && caught.field === 'currentPassword') {
        setPasswordError(caught.message);
      } else {
        setError(errorText(caught, 'We couldn’t delete your account. Try again.'));
      }
      setBusy(false);
    }
  };

  return (
    <Dialog open title="Delete your account" onClose={onClose}>
      {blocked ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-600">You can delete your account once these are done:</p>
          <ul className="space-y-2 text-sm text-navy">
            {deletion.blockers.map((blocker) => (
              <li key={blocker} className="flex gap-2">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
                {blocker}
              </li>
            ))}
          </ul>
          <Button type="button" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-5">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p className="font-semibold">This can’t be undone.</p>
            <ul className="mt-2 list-disc space-y-1 ps-5">
              <li>Your name, email, mobile, addresses, wishlist, cart and alerts are erased.</li>
              {(deletion.walletBalancePaise > 0 || deletion.coins > 0) && (
                <li>
                  Your wallet balance of {formatMoney(deletion.walletBalancePaise)}
                  {deletion.coins > 0 ? ` and ${deletion.coins} Trustlon Coins` : ''} will be lost.
                  Use it on an order first.
                </li>
              )}
              <li>
                Orders, invoices and payment records are kept for {deletion.retentionYears} years
                because the law requires it, without your contact details.
              </li>
            </ul>
          </div>
          <ListSelect
            label="Why are you leaving? (optional)"
            placeholder="Choose a reason"
            value={reason}
            onChange={setReason}
            options={deleteReasons.map((option) => ({ value: option, label: option }))}
          />
          {profile.hasPassword && (
            <PasswordField
              label="Password"
              autoComplete="current-password"
              showLabel="Show"
              hideLabel="Hide"
              value={password}
              error={passwordError}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}
          <TextField
            label="Type DELETE to confirm"
            autoComplete="off"
            autoCapitalize="characters"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <Alert>{error}</Alert>}
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
              Keep my account
            </Button>
            <Button
              type="submit"
              variant="destructive"
              loading={busy}
              disabled={confirm !== 'DELETE'}
            >
              Delete account
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}

function PrivacySection({ overview }: { overview: SettingsOverview }) {
  const [exporting, setExporting] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const download = async () => {
    setExporting(true);
    setNotice(null);
    try {
      await accountApi.exportData();
      setNotice({ tone: 'success', text: 'Your data file has been downloaded.' });
    } catch (error) {
      setNotice({
        tone: 'error',
        text:
          error instanceof ApiError && error.status === 429
            ? 'You can download your data 3 times an hour. Try again later.'
            : errorText(error, 'We couldn’t prepare your data. Try again.'),
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-navy">Download my data</h3>
          <p className="mt-1 text-sm text-slate-500">
            A file with your profile, orders, addresses, wallet, reviews and support chats.
          </p>
        </div>
        <button type="button" className={secondaryAction} onClick={download} disabled={exporting}>
          {exporting ? 'Preparing…' : 'Download (JSON)'}
        </button>
      </div>
      <div aria-live="polite" className="empty:hidden">
        {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
      </div>
      <div className="flex flex-col gap-4 border-t border-slate-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="font-semibold text-red-600">Delete my account</h3>
          <p className="mt-1 text-sm text-slate-500">
            Permanently erase your personal data, as allowed under India’s DPDP Act.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDeleting(true)}
          className={cn(secondaryAction, 'border-red-200 text-red-600 hover:bg-red-50')}
        >
          Delete account
        </button>
      </div>
      {deleting && <DeleteAccountDialog overview={overview} onClose={() => setDeleting(false)} />}
    </div>
  );
}

/** /account/settings (spec 3.11). */
export function SettingsPage() {
  const [overview, setOverview] = useState<SettingsOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [sessionsKey, setSessionsKey] = useState(0);

  useEffect(() => {
    accountApi
      .settings()
      .then(setOverview)
      .catch(() => setFailed(true));
  }, []);

  const setProfile = (profile: SettingsProfile) =>
    setOverview((current) => (current ? { ...current, profile } : current));

  const nav = useMemo(
    () => (
      <nav aria-label="Settings sections" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {SECTIONS.map(([id, label]) => (
          <a
            key={id}
            href={`#${id}`}
            className={cn(
              'h-9 shrink-0 rounded-full border border-slate-300 bg-white px-4 text-sm leading-9 text-navy hover:bg-navy-50',
              focusRing,
            )}
          >
            {label}
          </a>
        ))}
      </nav>
    ),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account settings"
        description="Your profile, sign-in and security, messages and privacy."
      />

      {failed && !overview ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your settings"
          description="Refresh the page to try again."
        />
      ) : !overview ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-64" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          {nav}
          <div id="profile" className="scroll-mt-6">
            <Panel title="Profile">
              <ProfileForm profile={overview.profile} onSaved={setProfile} />
            </Panel>
          </div>
          <div id="contact" className="scroll-mt-6">
            <Panel title="Email and mobile">
              <ContactSection profile={overview.profile} onSaved={setProfile} />
            </Panel>
          </div>
          <div id="security" className="scroll-mt-6">
            <Panel title="Security">
              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <div>
                  <h3 className="mb-4 text-sm font-semibold text-navy">
                    {overview.profile.hasPassword ? 'Change password' : 'Set a password'}
                  </h3>
                  <ChangePasswordForm
                    profile={overview.profile}
                    onChanged={() => {
                      setProfile({
                        ...overview.profile,
                        hasPassword: true,
                        passwordChangedAt: new Date().toISOString(),
                      });
                      setSessionsKey((key) => key + 1);
                    }}
                  />
                </div>
                <SessionsList refreshKey={sessionsKey} />
              </div>
            </Panel>
          </div>
          <div id="notifications" className="scroll-mt-6">
            <Panel title="Notifications">
              <NotificationPreferences
                initial={overview.notifications.channels}
                locked={overview.notifications.locked}
              />
            </Panel>
          </div>
          <div id="language" className="scroll-mt-6">
            <Panel title="Language">
              <LanguageSelector profile={overview.profile} onSaved={setProfile} />
            </Panel>
          </div>
          <div id="privacy" className="scroll-mt-6">
            <Panel title="Privacy">
              <PrivacySection overview={overview} />
            </Panel>
          </div>
          <p className="text-xs text-slate-500">
            Member since {formatDate(overview.profile.memberSince)}
          </p>
        </>
      )}
    </div>
  );
}
