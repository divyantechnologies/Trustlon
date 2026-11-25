import type { Metadata } from 'next';
import { Suspense } from 'react';
import { ReturnRequestForm } from '@/features/account';

export const metadata: Metadata = { title: 'Return items' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <ReturnRequestForm />
    </Suspense>
  );
}
