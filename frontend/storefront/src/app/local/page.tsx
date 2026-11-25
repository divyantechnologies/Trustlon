import { Suspense } from 'react';
import type { Metadata } from 'next';
import { LocalPage } from '@/features/local/LocalPage';

export const metadata: Metadata = { title: 'Local sellers' };

export default function Page() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-slate-500">
          Loading local sellers…
        </p>
      }
    >
      <LocalPage />
    </Suspense>
  );
}
