import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { BrowsePage } from '@/features/home';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  if ((await params).slug === 'search') {
    const query = new URLSearchParams();
    Object.entries(await searchParams).forEach(([key, value]) => {
      if (value !== undefined) query.set(key, Array.isArray(value) ? value[0] : value);
    });
    redirect(`/search${query.size ? `?${query}` : ''}`);
  }
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Loading collection…</p>}>
      <BrowsePage />
    </Suspense>
  );
}
