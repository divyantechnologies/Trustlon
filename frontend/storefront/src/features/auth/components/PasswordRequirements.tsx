'use client';

import { useI18n } from '@/lib/i18n/language-provider';
import { PASSWORD_RULES, passwordStrength, type PasswordRule, type PasswordStrength } from '../schemas';

const ORDER: PasswordRule[] = ['length', 'upper', 'lower', 'number'];

const TONES: Record<PasswordStrength, { bar: string; text: string }> = {
  weak: { bar: 'bg-red-600', text: 'text-red-600' },
  fair: { bar: 'bg-amber-500', text: 'text-amber-700' },
  good: { bar: 'bg-teal', text: 'text-teal-600' },
  strong: { bar: 'bg-teal-600', text: 'text-teal-600' },
};

/** Live checklist of the password rules with a strength meter. */
export function PasswordRequirements({ password }: { password: string }) {
  const { t, format } = useI18n();
  const strength = passwordStrength(password);
  const tone = TONES[strength.level];
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
      {password && (
        <div className="mb-2.5">
          <div className="grid grid-cols-4 gap-1" aria-hidden>
            {[1, 2, 3, 4].map((step) => (
              <span
                key={step}
                className={`h-1 rounded-full transition-colors ${step <= strength.score ? tone.bar : 'bg-slate-200'}`}
              />
            ))}
          </div>
          <p className={`mt-1.5 text-xs font-medium ${tone.text}`} aria-live="polite">
            {format(t.passwordRules.strength, { level: t.passwordRules[strength.level] })}
          </p>
        </div>
      )}
      <p className="text-xs font-medium text-slate-600">{t.passwordRules.title}</p>
      <ul className="mt-1.5 grid grid-cols-1 gap-x-4 gap-y-1 sm:grid-cols-2">
        {ORDER.map((rule) => {
          const met = PASSWORD_RULES[rule](password);
          return (
            <li
              key={rule}
              className={`flex items-center gap-1.5 text-xs ${met ? 'text-teal-600' : 'text-slate-500'}`}
            >
              <svg aria-hidden viewBox="0 0 16 16" className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2">
                {met ? (
                  <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
                ) : (
                  <circle cx="8" cy="8" r="5" />
                )}
              </svg>
              <span>
                {t.passwordRules[rule]}
                <span className="sr-only">{met ? ' ✓' : ''}</span>
              </span>
            </li>
          );
        })}
      </ul>
      {password && strength.level !== 'strong' && (
        <p className="mt-2 text-xs text-slate-500">{t.passwordRules.tip}</p>
      )}
    </div>
  );
}
