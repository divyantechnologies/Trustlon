'use client';
import { useSearchParams } from 'next/navigation';
import { useEffect, useId, useState } from 'react';
import { Alert, Button, cn, Dialog, inputClass, TextField } from '@/design-system';
import { ApiError } from '@/lib/http';
import { accountApi } from './api';
import { EmptyState, PageHeader, Panel, secondaryAction, Skeleton, Thumb } from './components/ui';
import {
  StarInput,
  Stars,
  UploadTiles,
  usePrivateFile,
  useUploads,
  type UploadItem,
} from './components/uploads';
import { formatDate } from './format';
import type { MyReview, PendingReview, ReviewStatus } from './types';

const STATUS: Record<ReviewStatus, { label: string; tone: string; note: string }> = {
  PUBLISHED: {
    label: 'Published',
    tone: 'bg-teal-50 text-teal-600',
    note: 'Visible to other shoppers.',
  },
  UNDER_MODERATION: {
    label: 'Under moderation',
    tone: 'bg-navy-50 text-navy',
    note: 'Our team is checking this review before it goes live.',
  },
  REJECTED: {
    label: 'Rejected',
    tone: 'bg-red-50 text-red-600',
    note: 'This review did not meet our guidelines.',
  },
};

const MEDIA_RULES = [
  { accept: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, label: 'Photos' },
  { accept: ['video/mp4'], maxBytes: 30 * 1024 * 1024, label: 'Videos' },
];

function ReviewMediaThumb({ id, kind }: { id: string; kind: 'PHOTO' | 'VIDEO' }) {
  const { url, failed } = usePrivateFile(() => accountApi.reviewMedia(id));
  if (failed)
    return (
      <span className="flex h-20 w-20 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
        Unavailable
      </span>
    );
  if (!url) return <Skeleton className="h-20 w-20" />;
  return kind === 'VIDEO' ? (
    <video
      src={url}
      controls
      preload="metadata"
      className="h-20 w-32 rounded-lg border border-slate-200 bg-black object-cover"
    />
  ) : (
    <img
      src={url}
      alt="Photo added to the review"
      className="h-20 w-20 rounded-lg border border-slate-200 object-cover"
    />
  );
}

interface FormTarget {
  product: { name: string; image: string };
  orderItemId: string;
  review: MyReview | null;
}

function ReviewForm({
  target,
  onClose,
  onSaved,
}: {
  target: FormTarget;
  onClose: () => void;
  onSaved: (review: MyReview) => void;
}) {
  const bodyId = useId();
  const existing = target.review;
  const [rating, setRating] = useState(existing?.rating ?? 0);
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState(existing?.body ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const initial: UploadItem[] = (existing?.media ?? []).map((m) => ({
    key: m.id,
    name: m.kind === 'VIDEO' ? 'Video' : 'Photo',
    kind: m.kind === 'VIDEO' ? 'video' : 'image',
    preview: null,
    id: m.id,
    error: null,
  }));
  const uploads = useUploads({
    max: 6,
    rules: MEDIA_RULES,
    upload: accountApi.uploadReviewMedia,
    initial,
  });

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!rating) return setError('Choose a star rating.');
    if (title.trim().length < 3) return setError('Write a short title (at least 3 characters).');
    if (body.trim().length < 10)
      return setError('Tell other shoppers a little more (at least 10 characters).');
    if (uploads.uploading) return setError('Wait for your files to finish uploading.');
    setSaving(true);
    try {
      const input = { rating, title: title.trim(), body: body.trim(), mediaIds: uploads.ids };
      onSaved(
        existing
          ? await accountApi.updateReview(existing.id, input)
          : await accountApi.createReview(target.orderItemId, input),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'We couldn’t save your review. Try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open title={existing ? 'Edit your review' : 'Write a review'} onClose={onClose}>
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="flex items-center gap-3">
          <Thumb src={target.product.image} alt="" className="h-14 w-14" />
          <p className="font-medium text-navy">{target.product.name}</p>
        </div>
        <StarInput value={rating} onChange={setRating} />
        <TextField
          label="Title"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sum it up in a few words"
        />
        <div>
          <label htmlFor={bodyId} className="mb-1.5 block text-sm font-medium text-navy">
            Your review
          </label>
          <textarea
            id={bodyId}
            rows={5}
            maxLength={2000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What did you like or dislike? How did you use it?"
            className={`${inputClass(false)} h-auto py-2`}
          />
          <p className="mt-1 text-end text-xs text-slate-500">{body.length}/2000</p>
        </div>
        <div>
          <p className="mb-2 text-sm font-medium text-navy">
            Photos and video{' '}
            <span className="font-normal text-slate-500">
              (optional, up to 5 photos and 1 video)
            </span>
          </p>
          <UploadTiles
            uploads={uploads}
            max={6}
            accept="image/jpeg,image/png,image/webp,video/mp4"
            addLabel="Add"
          />
        </div>
        <p className="text-xs text-slate-500">
          Reviews are checked automatically. Links, phone numbers or copied text send a review to
          our team before it goes live.
        </p>
        {error && <Alert>{error}</Alert>}
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" loading={saving} disabled={uploads.uploading}>
            {existing ? 'Save changes' : 'Submit review'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** /account/reviews (spec 3.7). Opens the form directly with ?item=<orderItemId>. */
export function ReviewsPage() {
  const params = useSearchParams();
  const [pending, setPending] = useState<PendingReview[] | null>(null);
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [failed, setFailed] = useState(false);
  const [target, setTarget] = useState<FormTarget | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = () =>
    accountApi
      .myReviews()
      .then((result) => {
        setPending(result.pending);
        setReviews(result.reviews);
        return result;
      })
      .catch(() => {
        setFailed(true);
        return null;
      });

  useEffect(() => {
    void load().then((result) => {
      const item = params.get('item');
      const match = result?.pending.find((p) => p.orderItemId === item);
      if (match)
        setTarget({ product: match.product, orderItemId: match.orderItemId, review: null });
    });
    // Runs once; the item in the link only opens the form on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My reviews"
        description="Help other shoppers by reviewing products you received."
      />
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>

      {failed && !pending ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your reviews"
          description="Refresh the page to try again."
        />
      ) : !pending ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      ) : (
        <>
          <Panel title={`Waiting for your review${pending.length ? ` (${pending.length})` : ''}`}>
            {pending.length === 0 ? (
              <p className="text-sm text-slate-500">
                You have reviewed everything you received. Thank you!
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {pending.map((item) => (
                  <li
                    key={item.orderItemId}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <Thumb src={item.product.image} alt="" className="h-16 w-16" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-navy">{item.product.name}</p>
                      <p className="text-xs text-slate-500">
                        {item.deliveredAt
                          ? `Delivered ${formatDate(item.deliveredAt)}`
                          : `Order #${item.orderNumber}`}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={secondaryAction}
                      onClick={() => {
                        setNotice(null);
                        setTarget({
                          product: item.product,
                          orderItemId: item.orderItemId,
                          review: null,
                        });
                      }}
                    >
                      Review
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Your reviews">
            {reviews.length === 0 ? (
              <p className="text-sm text-slate-500">Reviews you write will show here.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {reviews.map((review) => (
                  <li
                    key={review.id}
                    className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row"
                  >
                    <Thumb src={review.product.image} alt="" className="h-16 w-16" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-medium text-navy">{review.product.name}</p>
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-semibold',
                            STATUS[review.status].tone,
                          )}
                        >
                          {STATUS[review.status].label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={review.rating} />
                        <span className="text-sm font-semibold text-navy">{review.title}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
                        {review.body}
                      </p>
                      {review.media.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {review.media.map((m) => (
                            <ReviewMediaThumb key={m.id} id={m.id} kind={m.kind} />
                          ))}
                        </div>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {STATUS[review.status].note}
                        {review.rejectionReason ? ` Reason: ${review.rejectionReason}` : ''} ·
                        Written {formatDate(review.createdAt)}
                      </p>
                    </div>
                    <div>
                      <button
                        type="button"
                        className={secondaryAction}
                        onClick={() => {
                          setNotice(null);
                          setTarget({
                            product: review.product,
                            orderItemId: review.orderItemId,
                            review,
                          });
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}

      {target && (
        <ReviewForm
          key={target.orderItemId}
          target={target}
          onClose={() => setTarget(null)}
          onSaved={(review) => {
            setTarget(null);
            setNotice(
              review.status === 'PUBLISHED'
                ? 'Thanks! Your review is live.'
                : 'Thanks! Your review will go live once our team has checked it.',
            );
            void load();
          }}
        />
      )}
    </div>
  );
}
