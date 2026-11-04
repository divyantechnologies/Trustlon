'use client';

import { useCallback, useState } from 'react';
import { ApiError } from '@/lib/http';
import { useI18n } from '@/lib/i18n/language-provider';

export interface FormError {
  message: string;
  field?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
}

/** Converts thrown API errors into a message the form can show. */
export function useApiError() {
  const { t } = useI18n();
  const [error, setError] = useState<FormError | null>(null);

  const capture = useCallback(
    (caught: unknown): FormError => {
      const next: FormError =
        caught instanceof ApiError && caught.message
          ? {
              message: caught.message,
              field: caught.field,
              attemptsLeft: caught.attemptsLeft,
              retryAfterSeconds: caught.retryAfterSeconds,
            }
          : { message: t.common.somethingWrong };
      setError(next);
      return next;
    },
    [t],
  );

  return { error, setError, capture, clear: useCallback(() => setError(null), []) };
}
