'use client';

import { useEffect, useState } from 'react';
import { focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { apiBlob } from '@/lib/http';
import { DOCUMENT_TYPES, type VendorDetail } from './types';

/** Shows KYC documents inside the page (private files are fetched with the staff session). */
export function DocumentViewer({
  vendorId,
  documents,
}: {
  vendorId: string;
  documents: VendorDetail['documents'];
}) {
  const [selected, setSelected] = useState(documents[0]?.id ?? null);
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const doc = documents.find((d) => d.id === selected);

  useEffect(() => {
    if (!selected) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setUrl(null);
    setFailed(false);
    apiBlob(`/admin/vendors/${vendorId}/documents/${selected}`, controller.signal)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [selected, vendorId]);

  if (!documents.length)
    return <p className="text-sm text-slate-500">No documents uploaded yet.</p>;
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Documents">
        {documents.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === selected}
            onClick={() => setSelected(d.id)}
            className={cn(
              'h-8 rounded-full border px-3 text-xs',
              focusRing,
              d.id === selected
                ? 'border-navy bg-navy text-white'
                : 'border-slate-300 bg-white text-navy hover:bg-slate-50',
            )}
          >
            {DOCUMENT_TYPES[d.type] ?? d.type}
          </button>
        ))}
      </div>
      <div className="flex h-[26rem] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
        {failed ? (
          <p className="text-sm text-red-600">This document couldn’t be loaded.</p>
        ) : !url ? (
          <p className="text-sm text-slate-500">Loading document…</p>
        ) : doc?.contentType === 'application/pdf' ? (
          <iframe
            src={url}
            title={DOCUMENT_TYPES[doc.type] ?? 'Document'}
            className="h-full w-full"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={doc ? DOCUMENT_TYPES[doc.type] : 'Document'}
            className="max-h-full max-w-full object-contain"
          />
        )}
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-xs text-teal-600 hover:underline"
        >
          Open in a new tab
        </a>
      )}
    </div>
  );
}
