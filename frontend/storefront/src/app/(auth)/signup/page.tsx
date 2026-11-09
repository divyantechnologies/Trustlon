import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignupScreen } from '@/features/auth';

export const metadata: Metadata = { title: 'Create account', robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <SignupScreen />
    </Suspense>
  );
}
