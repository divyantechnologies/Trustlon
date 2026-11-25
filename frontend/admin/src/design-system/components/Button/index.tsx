'use client';

import { cn as cx } from '../../utils/cn';
import { focusRing } from '../../styles';

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'link';
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 text-sm font-semibold transition disabled:cursor-not-allowed',
        focusRing,
        variant === 'primary' &&
          'h-11 w-full rounded-lg bg-navy px-4 text-white shadow-sm hover:bg-navy-700 disabled:bg-navy/50',
        variant === 'secondary' &&
          'h-11 w-full rounded-lg border border-slate-300 bg-white px-4 text-navy hover:bg-slate-50 disabled:opacity-60',
        variant === 'outline' &&
          'h-11 w-full rounded-lg border border-slate-300 bg-transparent px-4 text-navy hover:bg-navy-50 disabled:opacity-60',
        variant === 'destructive' &&
          'h-11 w-full rounded-lg bg-red-600 px-4 text-white shadow-sm hover:bg-red-700 disabled:opacity-60',
        variant === 'link' && 'rounded-lg text-teal-600 hover:underline disabled:opacity-60',
        className,
      )}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}
