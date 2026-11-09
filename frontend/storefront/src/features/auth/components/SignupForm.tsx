'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, Checkbox, PasswordField, PhoneField, TextField } from '@/components/ui';
import { toApiLanguage, useI18n } from '@/lib/i18n/language-provider';
import { DEFAULT_COUNTRY, detectCountry, isCountryCode } from '@/lib/phone';
import { authApi, type SignupDetails } from '../api';
import { useAuth } from '../auth-provider';
import { safeNextPath, signupMobile, signupSchema, type SignupValues } from '../schemas';
import { useApiError } from '../use-api-error';
import { StepProgress } from './AuthShell';
import { OtpInput } from './OtpInput';
import { PasswordRequirements } from './PasswordRequirements';

type Step = 'details' | 'email' | 'mobile';
const STEP_NUMBER: Record<Step, number> = { details: 1, email: 2, mobile: 3 };

export function SignupForm() {
  const { t, language } = useI18n();
  const { startSession } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get('next'));
  const initialReferral = params.get('ref') ?? '';

  const [step, setStep] = useState<Step>('details');
  const [showReferral, setShowReferral] = useState(Boolean(initialReferral));
  const [resendAfter, setResendAfter] = useState(30);
  const [busy, setBusy] = useState(false);
  const emailToken = useRef<string | null>(null);
  const details = useRef<SignupDetails | null>(null);
  const { error, capture, clear } = useApiError();

  const schema = useMemo(() => signupSchema(t), [t]);
  const form = useForm<SignupValues>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: {
      fullName: '',
      email: '',
      mobileCountry: DEFAULT_COUNTRY,
      mobileNational: '',
      password: '',
      referralCode: initialReferral,
      acceptTerms: false,
      marketingOptIn: false,
    },
  });
  const { register, handleSubmit, watch, setValue, setError, formState } = form;
  const errors = formState.errors;
  const password = watch('password');
  const mobileCountry = watch('mobileCountry');

  useEffect(() => {
    setValue('mobileCountry', detectCountry());
  }, [setValue]);

  const submitDetails = handleSubmit(async (values) => {
    clear();
    setBusy(true);
    const payload: SignupDetails = {
      fullName: values.fullName.trim(),
      email: values.email.trim().toLowerCase(),
      mobile: signupMobile(values),
      password: values.password,
      country: values.mobileCountry,
      referralCode: values.referralCode.trim() || undefined,
      preferredLanguage: toApiLanguage(language),
      marketingOptIn: values.marketingOptIn,
      acceptTerms: true,
    };
    try {
      await authApi.validateSignup(payload);
      const sent = await authApi.sendOtp(payload.email, 'SIGNUP');
      details.current = payload;
      setResendAfter(sent.resendAfterSeconds);
      setStep('email');
    } catch (caught) {
      const failure = capture(caught);
      if (failure.field === 'email') setError('email', { message: failure.message });
      if (failure.field === 'mobile') setError('mobileNational', { message: failure.message });
      if (failure.field === 'referralCode') {
        setShowReferral(true);
        setError('referralCode', { message: failure.message });
      }
      if (failure.field) clear();
    } finally {
      setBusy(false);
    }
  });

  const verifyEmail = async (code: string) => {
    const payload = details.current;
    if (!payload) return;
    clear();
    setBusy(true);
    try {
      const { verificationToken } = await authApi.verifyForToken(payload.email, 'SIGNUP', code);
      emailToken.current = verificationToken;
      const sent = await authApi.sendOtp(payload.mobile, 'SIGNUP');
      setResendAfter(sent.resendAfterSeconds);
      setStep('mobile');
    } catch (caught) {
      capture(caught);
    } finally {
      setBusy(false);
    }
  };

  const verifyMobileAndCreate = async (code: string) => {
    const payload = details.current;
    if (!payload || !emailToken.current) return;
    clear();
    setBusy(true);
    try {
      const { verificationToken } = await authApi.verifyForToken(payload.mobile, 'SIGNUP', code);
      const session = await authApi.signup({
        ...payload,
        emailVerificationToken: emailToken.current,
        mobileVerificationToken: verificationToken,
      });
      startSession(session);
      router.replace(next);
    } catch (caught) {
      capture(caught);
      setBusy(false);
    }
  };

  const resendTo = (target: string) => async () => {
    clear();
    try {
      return (await authApi.sendOtp(target, 'SIGNUP')).resendAfterSeconds;
    } catch (caught) {
      capture(caught);
    }
  };

  const backToDetails = () => {
    clear();
    emailToken.current = null;
    setStep('details');
  };

  const progress = (
    <StepProgress
      current={STEP_NUMBER[step]}
      labels={[t.signup.stepDetails, t.signup.stepEmail, t.signup.stepMobile]}
    />
  );

  if (step !== 'details' && details.current) {
    const isEmail = step === 'email';
    const target = isEmail ? details.current.email : details.current.mobile;
    return (
      <div>
        {progress}
        <OtpInput
          key={step}
          channel={isEmail ? 'email' : 'mobile'}
          target={target}
          resendAfterSeconds={resendAfter}
          onResend={resendTo(target)}
          onSubmit={isEmail ? verifyEmail : verifyMobileAndCreate}
          onChangeTarget={backToDetails}
          submitLabel={isEmail ? t.signup.verifyEmail : t.signup.verifyAndCreate}
          error={error?.message}
          attemptsLeft={error?.attemptsLeft}
          loading={busy}
        />
      </div>
    );
  }

  return (
    <div>
      {progress}
      <form noValidate onSubmit={submitDetails} className="space-y-5">
        {error && <Alert>{error.message}</Alert>}

        <TextField
          label={t.fields.fullName}
          autoComplete="name"
          placeholder={t.placeholders.fullName}
          error={errors.fullName?.message}
          {...register('fullName')}
        />
        <TextField
          label={t.fields.email}
          type="email"
          autoComplete="email"
          placeholder={t.placeholders.email}
          error={errors.email?.message}
          {...register('email')}
        />
        <PhoneField
          label={t.fields.mobile}
          countryLabel={t.fields.country}
          locale={language}
          country={isCountryCode(mobileCountry) ? mobileCountry : DEFAULT_COUNTRY}
          onCountryChange={(country) =>
            setValue('mobileCountry', country, { shouldValidate: formState.isSubmitted })
          }
          placeholder={t.placeholders.mobile}
          error={errors.mobileNational?.message}
          {...register('mobileNational')}
        />
        <div className="space-y-2">
          <PasswordField
            label={t.fields.password}
            autoComplete="new-password"
            showLabel={t.common.show}
            hideLabel={t.common.hide}
            error={errors.password?.message}
            {...register('password')}
          />
          <PasswordRequirements password={password} />
        </div>

        {showReferral ? (
          <TextField
            label={t.fields.referralCode}
            autoCapitalize="characters"
            error={errors.referralCode?.message}
            {...register('referralCode')}
          />
        ) : (
          <Button
            type="button"
            variant="link"
            className="text-sm"
            onClick={() => setShowReferral(true)}
          >
            {t.signup.referralToggle}
          </Button>
        )}

        <div className="space-y-3 border-t border-slate-100 pt-5">
          <Checkbox
            error={errors.acceptTerms?.message}
            label={
              <>
                {t.signup.termsPrefix}{' '}
                <Link href="/pages/terms" target="_blank" className="font-medium text-navy underline underline-offset-2">
                  {t.signup.terms}
                </Link>{' '}
                {t.signup.and}{' '}
                <Link href="/pages/privacy" target="_blank" className="font-medium text-navy underline underline-offset-2">
                  {t.signup.privacy}
                </Link>
              </>
            }
            {...register('acceptTerms')}
          />
          <Checkbox label={t.signup.marketing} {...register('marketingOptIn')} />
        </div>

        <Button type="submit" loading={busy}>
          {busy ? t.common.pleaseWait : t.signup.continue}
        </Button>
      </form>
    </div>
  );
}
