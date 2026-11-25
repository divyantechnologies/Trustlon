export function ProductSkeleton() {
  return (
    <main role="status" aria-label="Loading product" className="mx-auto max-w-[1560px] p-6">
      <span className="sr-only">Loading product…</span>
      <div className="mb-6 h-10 animate-pulse rounded-xl bg-slate-200 motion-reduce:animate-none" />
      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-96 animate-pulse rounded-2xl bg-slate-200 motion-reduce:animate-none"
          />
        ))}
      </div>
    </main>
  );
}
