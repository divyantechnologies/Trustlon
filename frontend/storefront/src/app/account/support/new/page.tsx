import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NewTicket } from '@/features/account';

export const metadata: Metadata = { title: 'New support request' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <NewTicket />
    </Suspense>
  );
}
