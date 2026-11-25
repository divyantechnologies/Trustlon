import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReviewsPage } from '@/features/account';

export const metadata: Metadata = { title: 'My reviews' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <ReviewsPage />
    </Suspense>
  );
}
