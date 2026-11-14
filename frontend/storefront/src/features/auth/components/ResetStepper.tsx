'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Alert, Button, PasswordField } from '@/components/ui';
import { useI18n } from '@/lib/i18n/language-provider';
import { authApi } from '../api';
import {
  identifierSchema,
  identifierValue,
  newPasswordSchema,
  type IdentifierValues,
  type NewPasswordValues,
} from '../schemas';
import { useApiError } from '../use-api-error';
import { StepProgress } from './AuthShell';
import { IdentifierField, identifierDefaults } from './IdentifierField';
import { OtpInput } from './OtpInput';
import { PasswordRequirements } from './PasswordRequirements';

type Step = 1 | 2 | 3;

export function ResetStepper() {
  const { t } = useI18n();
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [target, setTarget] = useState<{ value: string; channel: 'email' | 'mobile' } | null>(null);
  const [verificationToken, setVerificationToken] = useState('');
  const [resendAfter, setResendAfter] = useState(30);
  const [busy, setBusy] = useState(false);
  const { error, capture, clear } = useApiError();

  const idSchema = useMemo(() => identifierSchema(t), [t]);
  const idForm = useForm<IdentifierValues>({
    resolver: zodResolver(idSchema),
    defaultValues: identifierDefaults,
  });

  const pwSchema = useMemo(() => newPasswordSchema(t), [t]);
  const pwForm = useForm<NewPasswordValues>({
    resolver: zodResolver(pwSchema),
    mode: 'onTouched',
    defaultValues: { newPassword: '', confirmPassword: '' },
  });
  const newPassword = pwForm.watch('newPassword');

  const sendCode = idForm.handleSubmit(async (values) => {
    clear();
    setBusy(true);
    const value = identifierValue(values);
    try {
      const result = await authApi.forgotPassword(value);
      setTarget({ value, channel: values.mode === 'email' ? 'email' : 'mobile' });
      setResendAfter(result.resendAfterSeconds);
      setStep(2);
    } catch (caught) {
      capture(caught);
    } finally {
      setBusy(false);
    }
  });

  const verify = async (code: string) => {
    if (!target) return;
    clear();
    setBusy(true);
    try {
      const result = await authApi.verifyForToken(target.value, 'RESET_PASSWORD', code);
      setVerificationToken(result.verificationToken);
      setStep(3);
    } catch (caught) {
      capture(caught);
    } finally {
      setBusy(false);
    }
  };

  const save = pwForm.handleSubmit(async ({ newPassword: password }) => {
    clear();
    setBusy(true);
    try {
      await authApi.resetPassword(verificationToken, password);
      router.replace('/login?reset=1');
    } catch (caught) {
      capture(caught);
      setBusy(false);
    }
  });

  return (
    <div>
      <StepProgress current={step} labels={[t.reset.step1, t.reset.step2, t.reset.step3]} />

      {step === 1 && (
        <form noValidate onSubmit={sendCode} className="space-y-5">
          {error && <Alert>{error.message}</Alert>}
          <IdentifierField form={idForm} />
          <Button type="submit" loading={busy}>
            {busy ? t.common.sending : t.reset.sendCode}
          </Button>
        </form>
      )}

      {step === 2 && target && (
        <OtpInput
          channel={target.channel}
          target={target.value}
          resendAfterSeconds={resendAfter}
          onResend={async () => {
            clear();
            try {
              return (await authApi.forgotPassword(target.value)).resendAfterSeconds;
            } catch (caught) {
              capture(caught);
            }
          }}
          onSubmit={verify}
          onChangeTarget={() => {
            clear();
            setStep(1);
          }}
          submitLabel={t.reset.verify}
          error={error?.message}
          attemptsLeft={error?.attemptsLeft}
          loading={busy}
        />
      )}

      {step === 3 && (
        <form noValidate onSubmit={save} className="space-y-5">
          {error && <Alert>{error.message}</Alert>}
          <div className="space-y-2">
            <PasswordField
              label={t.fields.newPassword}
              autoComplete="new-password"
              showLabel={t.common.show}
              hideLabel={t.common.hide}
              error={pwForm.formState.errors.newPassword?.message}
              {...pwForm.register('newPassword')}
            />
            <PasswordRequirements password={newPassword} />
          </div>
          <PasswordField
            label={t.fields.confirmNewPassword}
            autoComplete="new-password"
            showLabel={t.common.show}
            hideLabel={t.common.hide}
            error={pwForm.formState.errors.confirmPassword?.message}
            {...pwForm.register('confirmPassword')}
          />
          <Button type="submit" loading={busy}>
            {busy ? t.common.pleaseWait : t.reset.save}
          </Button>
        </form>
      )}
    </div>
  );
}
