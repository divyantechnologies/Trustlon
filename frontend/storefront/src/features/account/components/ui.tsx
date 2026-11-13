'use client';
import { cn } from '@/design-system';
import { STATUS_LABELS } from '../format';
import type { SubOrderStatus } from '../types';

/** White card used across the account pages. */
export function Panel({
  title,
  action,
  children,
  className,
  padded = true,
  as: Tag = 'section',
}: {
  title?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Set to false when the content brings its own padding. */
  padded?: boolean;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-slate-200 bg-white',
        padded && 'p-5 sm:p-6',
        className,
      )}
    >
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-semibold text-navy">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </Tag>
  );
}

const STATUS_TONES: Record<SubOrderStatus, string> = {
  PLACED: 'bg-navy-50 text-navy',
  CONFIRMED: 'bg-navy-50 text-navy',
  PACKED: 'bg-navy-50 text-navy',
  SHIPPED: 'bg-teal-50 text-teal-600',
  OUT_FOR_DELIVERY: 'bg-teal-50 text-teal-600',
  DELIVERED: 'bg-teal-50 text-teal-600',
  CANCELLED: 'bg-slate-100 text-slate-600',
  RETURN_REQUESTED: 'bg-navy-50 text-navy',
  RETURNED: 'bg-slate-100 text-slate-600',
};

export function StatusChip({ status, className }: { status: SubOrderStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS_TONES[status],
        className,
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {STATUS_LABELS[status]}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('animate-pulse rounded-lg bg-slate-100', className)} />;
}

/** Small product thumbnail that falls back to a neutral tile when the image fails. */
export function Thumb({ src, alt, className }: { src: string; alt: string; className?: string }) {
  return (
    <span
      className={cn(
        'block shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-navy-50',
        className,
      )}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={(event) => {
          event.currentTarget.style.visibility = 'hidden';
        }}
      />
    </span>
  );
}
