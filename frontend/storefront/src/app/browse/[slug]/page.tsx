import { Suspense } from 'react';
import { BrowsePage } from '@/features/home';

export default function Page() {
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Loading collection…</p>}>
      <BrowsePage />
    </Suspense>
  );
}
