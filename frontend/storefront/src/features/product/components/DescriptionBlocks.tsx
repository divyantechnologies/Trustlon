'use client';
import { useState } from 'react';
import type { Product } from '../types';
import type { CategoryConfig } from '../categoryConfig';
import { ProductImage } from './primitives';
export function DescriptionBlocks({
  description,
  config,
}: {
  description?: Product['description'];
  config: CategoryConfig;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!description) return null;
  return (
    <div className="space-y-8">
      {description.overview && (
        <div>
          <p className="whitespace-pre-line leading-7 text-slate-600">
            {!expanded && description.overview.length > 600
              ? `${description.overview.slice(0, 600)}…`
              : description.overview}
          </p>
          {description.overview.length > 600 && (
            <button
              className="mt-2 min-h-11 text-teal-700"
              aria-expanded={expanded}
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? 'Read less' : 'Read more'}
            </button>
          )}
        </div>
      )}
      {description.blocks?.map((b, i) => (
        <article key={i} className={`grid items-center gap-6 ${b.image ? 'md:grid-cols-2' : ''}`}>
          {b.image && (
            <ProductImage
              src={b.image}
              alt={b.title}
              className={`aspect-[4/3] w-full rounded-2xl object-cover ${i % 2 ? 'md:order-2' : ''}`}
            />
          )}
          <div>
            <h3 className="text-xl font-semibold">{b.title}</h3>
            <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{b.text}</p>
          </div>
        </article>
      ))}
      {!!description.inTheBox?.length && (
        <div className="rounded-xl bg-slate-50 p-5">
          <h3 className="font-semibold">{config.contentsLabel}</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-600">
            {description.inTheBox.map((v) => (
              <li key={v}>{v}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
