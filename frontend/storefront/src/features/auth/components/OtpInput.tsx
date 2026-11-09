'use client';

import { useEffect, useRef, useState } from 'react';
import { Alert, Button } from '@/components/ui';
import { useI18n } from '@/lib/i18n/language-provider';
import { maskIdentifier } from '../schemas';

const LENGTH = 6;

function CodeBoxes({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const { t, format } = useI18n();
  const refs = useRef<Array<HTMLInputElement | null>>([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setDigit = (index: number, digit: string) => {
    const chars = value.padEnd(LENGTH, ' ').split('');
    chars[index] = digit || ' ';
    onChange(chars.join('').trimEnd());
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, LENGTH);
    if (!digits) return;
    event.preventDefault();
    onChange(digits);
    refs.current[Math.min(digits.length, LENGTH - 1)]?.focus();
  };

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={handlePaste}>
      {Array.from({ length: LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            refs.current[index] = el;
          }}
          value={value[index]?.trim() ?? ''}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={format(t.otp.codeLabel, { index: index + 1 })}
          aria-invalid={invalid || undefined}
          onFocus={(event) => event.target.select()}
          onChange={(event) => {
            const digit = event.target.value.replace(/\D/g, '').slice(-1);
            setDigit(index, digit);
            if (digit && index < LENGTH - 1) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index]?.trim() && index > 0) {
              refs.current[index - 1]?.focus();
            }
            if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
            if (event.key === 'ArrowRight' && index < LENGTH - 1) refs.current[index + 1]?.focus();
          }}
          className={`aspect-square w-full rounded-lg border bg-white text-center text-xl font-semibold text-navy shadow-sm outline-none transition focus:ring-4 disabled:bg-slate-50 ${
            invalid
              ? 'border-red-500 focus:ring-red-500/15'
              : 'border-slate-300 focus:border-teal focus:ring-teal/15'
          }`}
        />
      ))}
    </div>
  );
}

export function OtpInput({
  channel,
  target,
  resendAfterSeconds,
  onResend,
  onSubmit,
  onChangeTarget,
  submitLabel,
  error,
  attemptsLeft,
  loading,
}: {
  channel: 'email' | 'mobile';
  target: string;
  resendAfterSeconds: number;
  onResend: () => Promise<number | void>;
  onSubmit: (code: string) => void;
  onChangeTarget: () => void;
  submitLabel: string;
  error?: string;
  attemptsLeft?: number;
  loading?: boolean;
}) {
  const { t, format } = useI18n();
  const [code, setCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(resendAfterSeconds);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const resend = async () => {
    setResending(true);
    try {
      const next = await onResend();
      setCode('');
      setSecondsLeft(typeof next === 'number' ? next : resendAfterSeconds);
    } finally {
      setResending(false);
    }
  };

  const complete = /^\d{6}$/.test(code);

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        if (complete) onSubmit(code);
      }}
    >
      <div className="flex gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-600">
          <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            {channel === 'email' ? (
              <path d="M4 6h16v12H4zM4 7l8 6 8-6" />
            ) : (
              <path d="M8 3h8a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm3 15h2" />
            )}
          </svg>
        </span>
        <div>
          <p className="font-medium text-navy">
            {channel === 'email' ? t.otp.titleEmail : t.otp.titleMobile}
          </p>
          <p className="mt-0.5 text-sm text-slate-500">
            {format(t.otp.sentTo, { target: maskIdentifier(target) })}{' '}
            <button
              type="button"
              onClick={onChangeTarget}
              className="font-medium text-teal-600 hover:underline"
            >
              {t.otp.change}
            </button>
          </p>
        </div>
      </div>

      <CodeBoxes value={code} onChange={setCode} disabled={loading} invalid={Boolean(error)} />

      {error && (
        <Alert>
          <span>
            {error}
            {attemptsLeft !== undefined && (
              <span className="font-medium"> · {format(t.otp.attemptsLeft, { count: attemptsLeft })}</span>
            )}
          </span>
        </Alert>
      )}

      <Button type="submit" loading={loading} disabled={!complete}>
        {loading ? t.common.verifying : submitLabel}
      </Button>

      <p className="text-center text-sm">
        {secondsLeft > 0 ? (
          <span className="text-slate-500">{format(t.otp.resendIn, { seconds: secondsLeft })}</span>
        ) : (
          <Button type="button" variant="link" onClick={resend} loading={resending}>
            {t.otp.resend}
          </Button>
        )}
      </p>
    </form>
  );
}
