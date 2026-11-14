import { z } from 'zod';
import type { Dictionary } from '@/lib/i18n/en';
import { formatInternational, isCountryCode, toE164 } from '@/lib/phone';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const PASSWORD_RULES = {
  length: (v: string) => v.length >= 8 && v.length <= 72,
  upper: (v: string) => /[A-Z]/.test(v),
  lower: (v: string) => /[a-z]/.test(v),
  number: (v: string) => /\d/.test(v),
} as const;
export type PasswordRule = keyof typeof PASSWORD_RULES;

export const meetsPasswordRules = (value: string) =>
  (Object.keys(PASSWORD_RULES) as PasswordRule[]).every((rule) => PASSWORD_RULES[rule](value));

const phoneFromValues = (country: string, national: string) =>
  isCountryCode(country) ? toE164(national, country) : null;

/* Sign-up */

export const signupSchema = (t: Dictionary) =>
  z
    .object({
      fullName: z.string().trim().min(2, t.validation.fullName).max(100, t.validation.fullName),
      email: z.string().trim().regex(EMAIL_PATTERN, t.validation.email).max(254, t.validation.email),
      mobileCountry: z.string(),
      mobileNational: z.string(),
      password: z.string().refine(meetsPasswordRules, t.validation.password),
      confirmPassword: z.string(),
      referralCode: z
        .string()
        .trim()
        .refine((v) => v === '' || /^[A-Za-z0-9]{6,12}$/.test(v), t.validation.referral),
      acceptTerms: z.boolean().refine((v) => v, t.validation.terms),
      marketingOptIn: z.boolean(),
    })
    .superRefine((values, ctx) => {
      if (!phoneFromValues(values.mobileCountry, values.mobileNational)) {
        ctx.addIssue({ code: 'custom', path: ['mobileNational'], message: t.validation.mobile });
      }
      if (values.confirmPassword !== values.password) {
        ctx.addIssue({
          code: 'custom',
          path: ['confirmPassword'],
          message: values.confirmPassword ? t.validation.passwordsMismatch : t.validation.confirmPasswordRequired,
        });
      }
    });
export type SignupValues = z.infer<ReturnType<typeof signupSchema>>;

export function signupMobile(values: Pick<SignupValues, 'mobileCountry' | 'mobileNational'>) {
  return phoneFromValues(values.mobileCountry, values.mobileNational) as string;
}

/* Email-or-mobile identifier, used by sign-in and password reset */

const identifierShape = {
  mode: z.enum(['email', 'phone']),
  email: z.string(),
  phoneCountry: z.string(),
  phoneNational: z.string(),
};

type IdentifierShape = { mode: 'email' | 'phone'; email: string; phoneCountry: string; phoneNational: string };

const refineIdentifier =
  (t: Dictionary) =>
  (values: IdentifierShape, ctx: z.RefinementCtx): void => {
    if (values.mode === 'email' && !EMAIL_PATTERN.test(values.email.trim())) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: t.validation.email });
    }
    if (values.mode === 'phone' && !phoneFromValues(values.phoneCountry, values.phoneNational)) {
      ctx.addIssue({ code: 'custom', path: ['phoneNational'], message: t.validation.mobile });
    }
  };

export const identifierSchema = (t: Dictionary) =>
  z.object(identifierShape).superRefine(refineIdentifier(t));
export type IdentifierValues = z.infer<ReturnType<typeof identifierSchema>>;

export const passwordLoginSchema = (t: Dictionary) =>
  z
    .object({ ...identifierShape, password: z.string().min(1, t.validation.passwordRequired) })
    .superRefine(refineIdentifier(t));
export type PasswordLoginValues = z.infer<ReturnType<typeof passwordLoginSchema>>;

/** The value the API expects: lower-case email or E.164 mobile number. */
export function identifierValue(values: IdentifierShape): string {
  return values.mode === 'email'
    ? values.email.trim().toLowerCase()
    : (phoneFromValues(values.phoneCountry, values.phoneNational) as string);
}

/* New password */

export const newPasswordSchema = (t: Dictionary) =>
  z
    .object({
      newPassword: z.string().refine(meetsPasswordRules, t.validation.password),
      confirmPassword: z.string(),
    })
    .refine((v) => v.newPassword === v.confirmPassword, {
      message: t.validation.passwordsMismatch,
      path: ['confirmPassword'],
    });
export type NewPasswordValues = z.infer<ReturnType<typeof newPasswordSchema>>;

/* Display helpers */

/** Masks an email or E.164 number for display, e.g. an***@example.com or +91 98••• ••210. */
export function maskIdentifier(value: string): string {
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    return `${name.slice(0, 2)}${'*'.repeat(Math.max(name.length - 2, 3))}@${domain}`;
  }
  const formatted = formatInternational(value);
  const digitsToHide = Math.max(formatted.replace(/\D/g, '').length - 7, 0);
  let hidden = 0;
  let seenDigits = 0;
  const countryDigits = formatted.split(' ')[0].replace(/\D/g, '').length;
  return formatted
    .split('')
    .map((char) => {
      if (!/\d/.test(char)) return char;
      seenDigits++;
      if (seenDigits > countryDigits + 2 && hidden < digitsToHide) {
        hidden++;
        return '•';
      }
      return char;
    })
    .join('');
}

/** Only allow same-site relative paths after sign-in, to prevent open redirects. */
export function safeNextPath(next: string | null): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/';
  return next;
}
