'use client';
import { Button } from '@/design-system';

/** Grey placeholder cards while a section loads. */
export function SectionSkeleton({ cards = 5, title = true }: { cards?: number; title?: boolean }) {
  return (
    <div aria-hidden className="animate-pulse">
      {title && <div className="mb-6 h-7 w-56 rounded bg-slate-200" />}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: cards }, (_, index) => (
          <div key={index} className="h-72 rounded-lg bg-slate-100" />
        ))}
      </div>
    </div>
  );
}

export function SectionError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-4 rounded-lg border border-slate-200 bg-white p-8 text-center"
    >
      <p className="text-slate-500">{message}</p>
      <div className="w-40">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
