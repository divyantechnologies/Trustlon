import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReturnDetailPage } from '@/features/account';

export const metadata: Metadata = { title: 'Return details' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <ReturnDetailPage />
    </Suspense>
  );
}
