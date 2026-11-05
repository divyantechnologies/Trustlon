'use client';

import { cn as cx } from '../../utils/cn';

export function Alert({
  tone = 'error',
  children,
}: {
  tone?: 'error' | 'success' | 'info';
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(
        'flex gap-2 rounded-lg border px-3 py-2.5 text-sm',
        tone === 'error' && 'border-red-200 bg-red-50 text-red-600',
        tone === 'success' && 'border-teal/30 bg-teal-50 text-teal-600',
        tone === 'info' && 'border-navy/10 bg-navy-50 text-navy',
      )}
    >
      {children}
    </div>
  );
}
