'use client';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, cn, Dialog } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';
import { formatInternational } from '@/lib/phone';
import { accountApi } from './api';
import {
  EmptyState,
  PageHeader,
  Panel,
  ReturnStatusChip,
  secondaryAction,
  Skeleton,
  Thumb,
} from './components/ui';
import { formatDate, formatDateTime, formatMoney, RETURN_STATUS_LABELS } from './format';
import type { ReturnDetail, ReturnStatus } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const JOURNEY: ReturnStatus[] = ['REQUESTED', 'APPROVED', 'PICKED_UP', 'RECEIVED', 'REFUNDED'];

/** Private photo: loaded with the customer's session, then shown from memory. */
function ReturnPhoto({ id }: { id: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let url: string | null = null;
    accountApi
      .returnPhoto(id, controller.signal)
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setSrc(url);
      })
      .catch(() => !controller.signal.aborted && setFailed(true));
    return () => {
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [id]);
  if (failed) {
    return (
      <span className="flex h-24 w-24 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-500">
        Unavailable
      </span>
    );
  }
  if (!src) return <Skeleton className="h-24 w-24" />;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block">
      <img
        src={src}
        alt="Photo added with the return"
        className="h-24 w-24 rounded-lg border border-slate-200 object-cover"
      />
    </a>
  );
}

/** Refund journey. Stopped returns show what happened instead of the remaining steps. */
function RefundTimeline({ item }: { item: ReturnDetail }) {
  const stopped = item.status === 'REJECTED' || item.status === 'CANCELLED';
  const reached = JOURNEY.indexOf(item.status);
  const eventFor = (status: ReturnStatus) =>
    [...item.events].reverse().find((event) => event.status === status);
  const steps: Array<{
    status: ReturnStatus;
    done: boolean;
    event: ReturnDetail['events'][number] | undefined;
  }> = stopped
    ? item.events.map((event) => ({ status: event.status, done: true, event }))
    : JOURNEY.map((status, index) => ({
        status,
        done: index <= reached,
        event: eventFor(status),
      }));

  return (
    <ol>
      {steps.map((step, index) => (
        <li key={`${step.status}-${index}`} className="relative flex gap-3 pb-4 last:pb-0">
          {index < steps.length - 1 && (
            <span
              aria-hidden
              className={cn(
                'absolute left-[9px] top-5 h-[calc(100%-12px)] w-0.5',
                steps[index + 1].done ? 'bg-teal' : 'bg-slate-200',
              )}
            />
          )}
          <span
            aria-hidden
            className={cn(
              'relative z-10 mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
              step.status === 'REJECTED' || step.status === 'CANCELLED'
                ? 'border-slate-400 bg-slate-400 text-white'
                : step.done
                  ? 'border-teal bg-teal text-white'
                  : 'border-slate-300 bg-white',
            )}
          >
            {step.done && (
              <Icon
                name={step.status === 'REJECTED' || step.status === 'CANCELLED' ? 'close' : 'check'}
                className="h-3 w-3"
                strokeWidth={3}
              />
            )}
          </span>
          <div className="min-w-0">
            <p className={cn('text-sm', step.done ? 'font-semibold text-navy' : 'text-slate-400')}>
              {step.event?.title ?? RETURN_STATUS_LABELS[step.status]}
            </p>
            {step.event && (
              <p className="text-xs text-slate-500">{formatDateTime(step.event.occurredAt)}</p>
            )}
            {step.event?.note && <p className="mt-0.5 text-xs text-slate-600">{step.event.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

/** /account/returns/:id (spec 3.3): status, refund timeline, items, photos and pickup address. */
export function ReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const created = useSearchParams().get('created') === '1';
  const [item, setItem] = useState<ReturnDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(
    created
      ? {
          tone: 'success',
          text: 'Your return request has been submitted. We’ll update you here at every step.',
        }
      : null,
  );

  useEffect(() => {
    if (!UUID.test(id)) {
      setState('missing');
      return;
    }
    const controller = new AbortController();
    accountApi
      .returnDetail(id, controller.signal)
      .then((data) => {
        setItem(data);
        setState('ready');
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setState(error instanceof ApiError && error.status === 404 ? 'missing' : 'error');
      });
    return () => controller.abort();
  }, [id, attempt]);

  const back = (
    <Link
      href="/account/returns"
      className="inline-flex min-h-11 items-center text-sm text-teal-600"
    >
      ← All returns
    </Link>
  );

  if (state === 'missing') {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          title="We couldn’t find this return"
          description="Check the link, or find it in your returns."
        />
      </div>
    );
  }
  if (state === 'error' && !item) {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          role="alert"
          title="We couldn’t load this return"
          action={
            <div className="w-40">
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          }
        />
      </div>
    );
  }
  if (!item) {
    return (
      <div className="space-y-4" aria-busy="true">
        {back}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const address = item.pickupAddress;

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={`Return #${item.returnNumber}`}
        description={`Requested on ${formatDate(item.requestedAt)} · ${item.reasonLabel}`}
        action={<ReturnStatusChip status={item.status} />}
      />
      <div aria-live="polite">{notice && <Alert tone={notice.tone}>{notice.text}</Alert>}</div>
      {item.status === 'REJECTED' && (
        <Alert>
          <span>
            The seller could not accept this return
            {item.rejectionReason ? `: ${item.rejectionReason}` : '.'} Contact support if you think
            this is a mistake.
          </span>
        </Alert>
      )}
      {item.status === 'APPROVED' && item.pickupScheduledFor && (
        <Alert tone="info">
          <span>
            Pickup scheduled for {formatDate(item.pickupScheduledFor)}. Keep the items packed with
            all tags and accessories.
          </span>
        </Alert>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <Panel title="Items">
            <ul className="space-y-4">
              {item.items.map((line) => (
                <li key={line.orderItemId} className="flex gap-4">
                  <Thumb src={line.image} alt="" className="h-16 w-16" />
                  <div className="min-w-0 flex-1">
                    {line.brand && (
                      <p className="text-xs uppercase tracking-wider text-slate-500">
                        {line.brand}
                      </p>
                    )}
                    <p className="font-medium text-navy">{line.name}</p>
                    <p className="text-sm text-slate-500">Qty {line.quantity}</p>
                  </div>
                  <p className="shrink-0 font-semibold text-navy">
                    {formatMoney(line.unitPricePaise * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-slate-100 pt-4 text-sm text-slate-500">
              From order{' '}
              <Link
                href={`/account/orders/${item.order.id}`}
                className="font-medium text-teal-600 hover:underline"
              >
                #{item.order.orderNumber}
              </Link>{' '}
              · sold by {item.seller.name}
            </p>
            {item.comments && (
              <blockquote className="mt-3 rounded-lg bg-navy-50 p-3 text-sm text-navy">
                “{item.comments}”
              </blockquote>
            )}
            {item.photos.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-3">
                {item.photos.map((photo) => (
                  <ReturnPhoto key={photo.id} id={photo.id} />
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Progress">
            <RefundTimeline item={item} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Refund">
            <p className="text-2xl font-semibold text-navy">
              {formatMoney(item.refund.amountPaise)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              {item.status === 'REFUNDED'
                ? `Refunded to ${item.refund.destination}${item.refund.refundedAt ? ` on ${formatDate(item.refund.refundedAt)}` : ''}.`
                : item.status === 'REJECTED' || item.status === 'CANCELLED'
                  ? 'No refund for this return.'
                  : `Goes to ${item.refund.destination} once the seller checks the items.`}
            </p>
            {item.refund.reference && item.status === 'REFUNDED' && (
              <p className="mt-2 text-xs text-slate-500">Reference {item.refund.reference}</p>
            )}
          </Panel>

          <Panel title="Pickup address">
            <address className="text-sm not-italic leading-6 text-navy">
              <span className="font-semibold">{address.name}</span>
              <br />
              {address.line1}
              {address.line2 ? `, ${address.line2}` : ''}
              <br />
              {address.city}, {address.state} {address.pincode}
              {address.mobile && (
                <>
                  <br />
                  <span className="text-slate-500">
                    Mobile {formatInternational(address.mobile)}
                  </span>
                </>
              )}
            </address>
          </Panel>

          <div className="flex flex-col gap-3">
            {item.canCancel && (
              <button type="button" className={secondaryAction} onClick={() => setConfirming(true)}>
                <Icon name="close" className="h-4 w-4" />
                Cancel return
              </button>
            )}
            <Link href="/browse/help" className={secondaryAction}>
              Need help?
            </Link>
          </div>
        </div>
      </div>

      <Dialog open={confirming} title="Cancel this return?" onClose={() => setConfirming(false)}>
        <div className="space-y-5">
          <p className="text-sm text-slate-600">
            The pickup will be cancelled and you keep the items. You can raise a new return while
            the return window is open.
          </p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" onClick={() => setConfirming(false)} disabled={cancelling}>
              Keep return
            </Button>
            <Button
              variant="destructive"
              loading={cancelling}
              onClick={async () => {
                setCancelling(true);
                try {
                  setItem(await accountApi.cancelReturn(item.id));
                  setNotice({ tone: 'success', text: 'Your return has been cancelled.' });
                } catch (error) {
                  setNotice({
                    tone: 'error',
                    text:
                      error instanceof ApiError && error.message
                        ? error.message
                        : 'We couldn’t cancel this return.',
                  });
                } finally {
                  setCancelling(false);
                  setConfirming(false);
                }
              }}
            >
              Cancel return
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
