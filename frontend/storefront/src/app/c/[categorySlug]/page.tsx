import { Suspense } from 'react';
import { CategoryPage } from '@/features/category/CategoryPage';

export default async function Page({ params }: { params: Promise<{ categorySlug: string }> }) {
  const { categorySlug } = await params;
  return (
    <Suspense fallback={<p className="p-6 text-slate-500">Loading category…</p>}>
      <CategoryPage key={categorySlug} slug={categorySlug} />
    </Suspense>
  );
}
