import { Suspense } from 'react';
import type { Metadata } from 'next';
import { SearchPage } from '@/features/search/SearchPage';

export const metadata: Metadata = { title: 'Search products' };

export default function Page() {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-slate-500">
          Loading search…
        </p>
      }
    >
      <SearchPage />
    </Suspense>
  );
}
