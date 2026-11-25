'use client';
import { useEffect, useId, useRef } from 'react';
import { focusRing } from '../../styles';
import { cn } from '../../utils/cn';
export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!open) {
      if (dialog.open) dialog.close();
      return;
    }
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg bg-white p-0 text-navy shadow-sm backdrop:bg-navy/60"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
        <h2 id={titleId} className="text-lg font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className={cn(
            'flex h-11 w-11 items-center justify-center rounded-lg text-2xl hover:bg-navy-50',
            focusRing,
          )}
        >
          ×
        </button>
      </div>
      <div className="p-6">{children}</div>
    </dialog>
  );
}
