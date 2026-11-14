'use client';
import { cn } from '@/design-system';
import { RETURN_STATUS_LABELS, STATUS_LABELS } from '../format';
import type { ReturnStatus, SubOrderStatus } from '../types';

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

const RETURN_TONES: Record<ReturnStatus, string> = {
  REQUESTED: 'bg-navy-50 text-navy',
  APPROVED: 'bg-navy-50 text-navy',
  PICKED_UP: 'bg-teal-50 text-teal-600',
  RECEIVED: 'bg-teal-50 text-teal-600',
  REFUNDED: 'bg-teal-50 text-teal-600',
  REJECTED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export function ReturnStatusChip({ status }: { status: ReturnStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        RETURN_TONES[status],
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {RETURN_STATUS_LABELS[status]}
    </span>
  );
}

/** Title, description and optional action at the top of each account page. */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold text-navy">{title}</h1>
        {description && <p className="mt-1 text-slate-500">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Centered message for empty lists and load errors. */
export function EmptyState({
  title,
  description,
  action,
  role,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  role?: 'alert';
}) {
  return (
    <div role={role} className="rounded-lg border border-slate-200 bg-white p-10 text-center">
      <p className="font-semibold text-navy">{title}</p>
      {description && <p className="mt-1 text-slate-500">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export const primaryLink =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-navy px-5 text-sm font-semibold text-white hover:bg-navy-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2';

export const secondaryAction =
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2';
