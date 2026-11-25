'use client';

import { useId, useRef, useState } from 'react';
import { apiUpload } from '@/lib/http';
import { Btn } from './ui';

/** An image chosen by upload (stored by the API) or by pasting a URL/path. */
export function ImageField({
  label,
  value,
  onChange,
  kind,
  hint,
}: {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  kind: 'banner' | 'category' | 'seo' | 'page';
  hint?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) return setError('Use an image of 3 MB or less.');
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const { url } = await apiUpload<{ url: string }>(`/admin/assets?kind=${kind}`, form);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-navy">
        {label}
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={value} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-xs text-slate-400">No image</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <input
            id={id}
            value={value ?? ''}
            placeholder="/images/… or upload"
            onChange={(e) => onChange(e.target.value.trim() || null)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-navy outline-none focus:border-teal focus:ring-4 focus:ring-teal/15"
          />
          <div className="flex flex-wrap gap-2">
            <Btn size="sm" loading={busy} onClick={() => input.current?.click()}>
              Upload image
            </Btn>
            {value && (
              <Btn size="sm" tone="ghost" onClick={() => onChange(null)}>
                Remove
              </Btn>
            )}
          </div>
          {error ? (
            <p className="text-xs text-red-600">{error}</p>
          ) : hint ? (
            <p className="text-xs text-slate-500">{hint}</p>
          ) : null}
        </div>
      </div>
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void upload(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
