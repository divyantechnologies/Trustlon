'use client';
import { useState } from 'react';
import type { ProductActions, Review } from '../types';
import { Modal, ProductImage, secondary, field } from './primitives';
export function ReviewList({
  reviews = [],
  vote,
}: {
  reviews?: Review[];
  vote?: ProductActions['vote'];
}) {
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Helpful');
  const [page, setPage] = useState(1);
  const [voted, setVoted] = useState<string[]>([]);
  const [busy, setBusy] = useState<string>();
  const [notice, setNotice] = useState('');
  const [photo, setPhoto] = useState<{ url: string; alt: string }>();
  const filtered = reviews
    .filter(
      (r) =>
        filter === 'All' ||
        (filter === 'With photos' && r.photos.length) ||
        (filter === 'Verified' && r.verified) ||
        (filter === '5 stars' && r.rating === 5) ||
        (filter === 'Critical' && r.rating <= 2),
    )
    .slice()
    .sort((a, b) =>
      sort === 'Newest' ? Date.parse(b.date) - Date.parse(a.date) : b.helpful - a.helpful,
    );
  const pages = Math.max(1, Math.ceil(filtered.length / 3));
  const currentPage = Math.min(page, pages);
  const photos = reviews.flatMap((r) => r.photos).slice(0, 12);
  return (
    <>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {reviews.length ? `${reviews.length} customer reviews` : 'Be the first to review'}
        </p>
        <a className={secondary} href="/account/reviews">
          Write a review
        </a>
      </div>
      {!!photos.length && (
        <div className="mb-5">
          <h3 className="mb-3 text-sm font-semibold">Customer photos</h3>
          <div className="flex gap-3 overflow-auto">
            {photos.map((p, i) => (
              <button
                key={i}
                onClick={() => setPhoto(p)}
                aria-label={`View customer photo ${i + 1}`}
              >
                <ProductImage
                  src={p.url}
                  alt={p.alt}
                  className="h-20 w-20 max-w-none rounded-xl object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
      {!!reviews.length && (
        <>
          <div className="mb-5 flex flex-wrap gap-2">
            {['All', 'With photos', 'Verified', '5 stars', 'Critical'].map((f) => (
              <button
                key={f}
                aria-pressed={filter === f}
                className={`${secondary} ${filter === f ? '!border-teal-600 !bg-teal-50' : ''}`}
                onClick={() => {
                  setFilter(f);
                  setPage(1);
                }}
              >
                {f}
              </button>
            ))}
            <label className="ml-auto flex items-center gap-2 text-sm">
              Sort
              <select
                className={field}
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setPage(1);
                }}
              >
                <option>Helpful</option>
                <option>Newest</option>
              </select>
            </label>
          </div>
          {!filtered.length && (
            <p className="py-5 text-slate-500">No reviews match this filter. Try another.</p>
          )}
          <div className="divide-y divide-slate-100">
            {filtered.slice((currentPage - 1) * 3, currentPage * 3).map((r) => (
              <article key={r.id} className="py-5 first:pt-0">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-800">
                    {r.rating} ★
                  </span>
                  <h3 className="font-semibold">{r.title}</h3>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                  <span>{r.author}</span>
                  {r.verified && <span className="text-teal-700">✓ Verified purchase</span>}
                  <time dateTime={r.date}>
                    {new Date(r.date).toLocaleDateString('en-IN', { timeZone: 'UTC' })}
                  </time>
                </div>
                <p className="mt-3 whitespace-pre-line leading-7 text-slate-600">{r.text}</p>
                {!!r.photos.length && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.photos.map((p, i) => (
                      <button
                        key={i}
                        onClick={() => setPhoto(p)}
                        aria-label={`Open photo ${i + 1} from ${r.author}`}
                      >
                        <ProductImage
                          src={p.url}
                          alt={p.alt}
                          className="h-16 w-16 rounded-lg object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
                {r.sellerReply && (
                  <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm">
                    <p className="font-semibold">Seller reply</p>
                    <p className="mt-1 text-slate-600">{r.sellerReply}</p>
                  </div>
                )}
                <button
                  className="mt-3 min-h-11 text-sm text-teal-700 disabled:text-slate-500"
                  disabled={!vote || voted.includes(r.id) || busy === r.id}
                  aria-pressed={voted.includes(r.id)}
                  onClick={async () => {
                    if (!vote) return;
                    setBusy(r.id);
                    try {
                      await vote('review', r.id);
                      setVoted((v) => [...v, r.id]);
                    } catch (e) {
                      setNotice(e instanceof Error ? e.message : 'Please try again.');
                    } finally {
                      setBusy(undefined);
                    }
                  }}
                >
                  Helpful ({r.helpful + Number(voted.includes(r.id))})
                </button>
              </article>
            ))}
          </div>
          {pages > 1 && (
            <nav aria-label="Review pages" className="mt-4 flex items-center gap-4">
              <button
                className={secondary}
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                Previous
              </button>
              <span aria-live="polite" className="text-sm">
                {currentPage} of {pages}
              </span>
              <button
                className={secondary}
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Next
              </button>
            </nav>
          )}
        </>
      )}
      <p role="status" className="text-sm text-teal-700">
        {notice}
      </p>
      {photo && (
        <Modal title="Customer photo" onClose={() => setPhoto(undefined)}>
          <ProductImage
            src={photo.url}
            alt={photo.alt}
            className="max-h-[65vh] w-full object-contain"
          />
        </Modal>
      )}
    </>
  );
}
