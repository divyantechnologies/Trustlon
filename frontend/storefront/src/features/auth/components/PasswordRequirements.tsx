'use client';

import { useI18n } from '@/lib/i18n/language-provider';
import { PASSWORD_RULES, type PasswordRule } from '../schemas';

const ORDER: PasswordRule[] = ['length', 'upper', 'lower', 'number'];

export function PasswordRequirements({ password }: { password: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2.5">
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
    </div>
  );
}
