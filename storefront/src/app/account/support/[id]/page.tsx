import type { Metadata } from 'next';
import { Suspense } from 'react';
import { TicketThread } from '@/features/account';

export const metadata: Metadata = { title: 'Support request' };

export default function Page() {
  return (
    <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
      <TicketThread />
    </Suspense>
  );
}
