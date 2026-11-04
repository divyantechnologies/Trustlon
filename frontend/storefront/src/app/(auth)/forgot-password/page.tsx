import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ForgotPasswordScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'Reset password', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <ForgotPasswordScreen />
    </Suspense>
  );
}
