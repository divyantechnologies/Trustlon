'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
export const card = 'rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-7';
export const button =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#12203F] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24365b] disabled:cursor-not-allowed disabled:opacity-40';
export const secondary =
  'inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-[#12203F] hover:bg-slate-50 disabled:opacity-40';
export const field = 'min-h-11 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm';
export function Icon({ name = 'spark' }: { name?: string }) {
  const paths: Record<string, string> = {
    spark: 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z',
    music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-3-3h3m11 1a3 3 0 1 1-3-3h3',
    battery: 'M3 7h16v10H3zM21 10v4M7 10v4m4-4v4',
    fabric: 'm8 3-6 5 4 4 2-2v11h8V10l2 2 4-4-6-5a4 4 0 0 1-8 0',
    device: 'M6 2h12v20H6zM10 18h4',
    leaf: 'M20 3C8 2 2 7 4 15s15 8 16-12ZM4 20l11-11',
    home: 'm3 11 9-8 9 8M5 9v12h14V9m-9 12v-7h4v7',
    activity: 'M2 12h5l3-8 4 16 3-8h5',
    shield: 'm12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6Zm-5 10 3 3 7-7',
    box: 'm3 7 9-4 9 4v12l-9 4-9-4Zm0 0 9 5 9-5m-9 5v11',
  };
  return (
    <svg
      aria-hidden="true"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name] ?? paths.spark} />
    </svg>
  );
}
export function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    const previous = document.activeElement as HTMLElement;
    el?.showModal();
    return () => {
      el?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      className="m-auto max-h-[85dvh] w-[min(92vw,720px)] overflow-auto rounded-2xl p-6 text-[#12203F] backdrop:bg-slate-950/60"
      aria-label={title}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button autoFocus className={secondary} onClick={onClose} aria-label="Close dialog">
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ProductImage({
  src,
  alt,
  eager = false,
  className = '',
}: {
  src?: string;
  alt: string;
  eager?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  return src && failed !== src ? (
    <img
      src={src}
      alt={alt}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      className={className}
      onError={() => setFailed(src)}
    />
  ) : (
    <div
      role="img"
      aria-label={alt}
      className={`flex items-center justify-center bg-slate-50 text-slate-500 ${className}`}
    >
      <span>Image coming soon</span>
    </div>
  );
}
