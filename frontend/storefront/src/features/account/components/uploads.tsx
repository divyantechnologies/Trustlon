'use client';
import { useEffect, useRef, useState } from 'react';
import { cn, focusRing } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';

export interface UploadItem {
  key: string;
  name: string;
  kind: 'image' | 'video' | 'file';
  preview: string | null;
  id: string | null;
  error: string | null;
}

interface UploadRule {
  accept: string[];
  maxBytes: number;
  label: string;
}

/**
 * Uploads files one by one as soon as they are chosen, and keeps their ids for the form.
 * `rules` lists accepted types; the first rule that matches a file's type applies.
 */
export function useUploads(options: {
  max: number;
  rules: UploadRule[];
  upload: (file: File) => Promise<{ id: string }>;
  initial?: UploadItem[];
}) {
  const [items, setItems] = useState<UploadItem[]>(options.initial ?? []);
  const [notice, setNotice] = useState<string | null>(null);
  const previews = useRef<string[]>([]);
  previews.current = items
    .map((item) => item.preview)
    .filter((url): url is string => Boolean(url?.startsWith('blob:')));
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const add = async (files: FileList | null) => {
    if (!files?.length) return;
    setNotice(null);
    const room = options.max - items.length;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setNotice(`You can add up to ${options.max} files.`);
    for (const file of chosen) {
      const key = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const rule = options.rules.find((r) => r.accept.includes(file.type));
      const kind: UploadItem['kind'] = file.type.startsWith('image/')
        ? 'image'
        : file.type.startsWith('video/')
          ? 'video'
          : 'file';
      const item: UploadItem = {
        key,
        name: file.name,
        kind,
        preview: kind === 'file' ? null : URL.createObjectURL(file),
        id: null,
        error: !rule
          ? 'This file type is not supported'
          : file.size > rule.maxBytes
            ? `${rule.label} must be ${Math.round(rule.maxBytes / 1024 / 1024)} MB or smaller`
            : null,
      };
      setItems((current) => [...current, item]);
      if (item.error) continue;
      try {
        const { id } = await options.upload(file);
        setItems((current) => current.map((i) => (i.key === key ? { ...i, id } : i)));
      } catch (error) {
        const message =
          error instanceof ApiError && error.message ? error.message : 'Upload failed. Try again.';
        setItems((current) => current.map((i) => (i.key === key ? { ...i, error: message } : i)));
      }
    }
  };

  const remove = (key: string) =>
    setItems((current) => {
      const item = current.find((i) => i.key === key);
      if (item?.preview?.startsWith('blob:')) URL.revokeObjectURL(item.preview);
      return current.filter((i) => i.key !== key);
    });

  const uploading = items.some((item) => !item.id && !item.error);
  const ids = items.filter((item) => item.id).map((item) => item.id as string);
  return { items, add, remove, uploading, ids, notice, setItems };
}

/** Thumbnails of chosen files with remove buttons, plus an "Add" tile. */
export function UploadTiles({
  uploads,
  max,
  accept,
  addLabel = 'Add photo',
}: {
  uploads: ReturnType<typeof useUploads>;
  max: number;
  accept: string;
  addLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <ul className="flex flex-wrap gap-3">
        {uploads.items.map((item) => (
          <li key={item.key} className="relative w-24">
            {item.kind === 'image' && item.preview ? (
              <img
                src={item.preview}
                alt={item.name}
                className={cn(
                  'h-24 w-24 rounded-lg border object-cover',
                  item.error ? 'border-red-300 opacity-50' : 'border-slate-200',
                )}
              />
            ) : (
              <span
                className={cn(
                  'flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border bg-navy-50 p-2 text-center text-[11px] text-navy',
                  item.error ? 'border-red-300 opacity-60' : 'border-slate-200',
                )}
              >
                <Icon
                  name={item.kind === 'video' ? 'arrow' : 'bag'}
                  className="h-5 w-5 text-teal-600"
                />
                <span className="line-clamp-2 break-all">{item.name}</span>
              </span>
            )}
            {!item.id && !item.error && (
              <span className="absolute inset-0 flex h-24 items-center justify-center rounded-lg bg-white/70 text-xs text-navy">
                Uploading…
              </span>
            )}
            <button
              type="button"
              onClick={() => uploads.remove(item.key)}
              aria-label={`Remove ${item.name}`}
              className={cn(
                'absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-navy shadow-sm',
                focusRing,
              )}
            >
              <Icon name="close" className="h-3.5 w-3.5" />
            </button>
            {item.error && (
              <p className="mt-1 text-[11px] leading-tight text-red-600">{item.error}</p>
            )}
          </li>
        ))}
        {uploads.items.length < max && (
          <li>
            <button
              type="button"
              onClick={() => input.current?.click()}
              className={cn(
                'flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 text-xs text-slate-500 hover:border-teal hover:text-teal-600',
                focusRing,
              )}
            >
              <Icon name="plus" className="h-5 w-5" />
              {addLabel}
            </button>
          </li>
        )}
      </ul>
      {uploads.notice && <p className="mt-2 text-xs text-red-600">{uploads.notice}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          void uploads.add(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

/** A private file (photo or document) loaded with the customer's session. */
export function usePrivateFile(load: (() => Promise<Blob>) | null): {
  url: string | null;
  failed: boolean;
} {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!load) return;
    let active = true;
    let objectUrl: string | null = null;
    load()
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setUrl(objectUrl);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Load once per mount; callers key the component by file id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return { url, failed };
}

/** Star rating picker, keyboard friendly (radio group). */
export function StarInput({
  value,
  onChange,
}: {
  value: number;
  onChange: (value: number) => void;
}) {
  const labels = ['Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-navy">Your rating</legend>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <label
            key={star}
            className="cursor-pointer rounded-lg has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal"
          >
            <input
              type="radio"
              name="rating"
              value={star}
              checked={value === star}
              onChange={() => onChange(star)}
              className="sr-only"
              aria-label={`${star} star${star > 1 ? 's' : ''}: ${labels[star - 1]}`}
            />
            <Icon
              name="star"
              className={cn('h-8 w-8', star <= value ? 'fill-teal text-teal' : 'text-slate-300')}
            />
          </label>
        ))}
        <span className="ms-2 text-sm text-slate-500">
          {value ? labels[value - 1] : 'Tap a star'}
        </span>
      </div>
    </fieldset>
  );
}

export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-0.5', className)}
      aria-label={`${value} out of 5 stars`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Icon
          key={star}
          name="star"
          className={cn('h-4 w-4', star <= value ? 'fill-teal text-teal' : 'text-slate-300')}
        />
      ))}
    </span>
  );
}
