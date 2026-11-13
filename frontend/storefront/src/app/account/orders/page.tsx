import type { Metadata } from 'next';
import { Suspense } from 'react';
import { OrdersList } from '@/features/account';

export const metadata: Metadata = { title: 'Your orders' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading orders…</p>}>
      <OrdersList />
    </Suspense>
  );
}
