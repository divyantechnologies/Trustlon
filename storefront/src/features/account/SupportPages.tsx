'use client';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, cn, focusRing, inputClass, ListSelect, TextField } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';
import { accountApi } from './api';
import {
  EmptyState,
  PageHeader,
  Panel,
  primaryLink,
  secondaryAction,
  Skeleton,
} from './components/ui';
import { UploadTiles, useUploads } from './components/uploads';
import { formatDate, formatDateTime } from './format';
import type {
  OrderSummary,
  TicketCategory,
  TicketDetail,
  TicketStatus,
  TicketSummary,
} from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS: Record<TicketStatus, { label: string; tone: string }> = {
  OPEN: { label: 'Open', tone: 'bg-navy-50 text-navy' },
  IN_PROGRESS: { label: 'In progress', tone: 'bg-navy-50 text-navy' },
  AWAITING_CUSTOMER: { label: 'Waiting for you', tone: 'bg-teal-50 text-teal-600' },
  RESOLVED: { label: 'Resolved', tone: 'bg-slate-100 text-slate-600' },
  CLOSED: { label: 'Closed', tone: 'bg-slate-100 text-slate-600' },
};

const CATEGORIES: Array<{ value: TicketCategory; label: string }> = [
  { value: 'ORDER', label: 'An order' },
  { value: 'DELIVERY', label: 'Delivery or tracking' },
  { value: 'RETURN_REFUND', label: 'Return or refund' },
  { value: 'PAYMENT', label: 'Payment' },
  { value: 'PRODUCT', label: 'A product' },
  { value: 'ACCOUNT', label: 'My account' },
  { value: 'OTHER', label: 'Something else' },
];

const FILE_RULES = [
  { accept: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 5 * 1024 * 1024, label: 'Images' },
  { accept: ['application/pdf'], maxBytes: 5 * 1024 * 1024, label: 'PDFs' },
];
const FILE_ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

export function TicketStatusChip({ status }: { status: TicketStatus }) {
  return (
    <span
      className={cn(
        'inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold',
        STATUS[status].tone,
      )}
    >
      {STATUS[status].label}
    </span>
  );
}

/** /account/support (spec 3.10). */
export function SupportList() {
  const [filter, setFilter] = useState<'open' | 'resolved' | undefined>(undefined);
  const [items, setItems] = useState<TicketSummary[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    setPage(1);
    setItems([]);
  }, [filter]);

  useEffect(() => {
    const controller = new AbortController();
    setState('loading');
    accountApi
      .tickets(page, filter, controller.signal)
      .then((result) => {
        setItems((previous) => (page === 1 ? result.items : [...previous, ...result.items]));
        setTotalPages(result.totalPages);
        setState('ready');
      })
      .catch(() => !controller.signal.aborted && setState('error'));
    return () => controller.abort();
  }, [page, filter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Help and support"
        description="Ask us about an order, a return, a payment or anything else."
        action={
          <Link href="/account/support/new" className={primaryLink}>
            <Icon name="plus" className="h-4 w-4" />
            New request
          </Link>
        }
      />
      <div role="group" aria-label="Filter requests" className="flex gap-2">
        {[
          { value: undefined, label: 'All' },
          { value: 'open' as const, label: 'Open' },
          { value: 'resolved' as const, label: 'Resolved' },
        ].map((option) => (
          <button
            key={option.label}
            type="button"
            aria-pressed={filter === option.value}
            onClick={() => setFilter(option.value)}
            className={cn(
              'h-10 rounded-full border px-4 text-sm',
              focusRing,
              filter === option.value
                ? 'border-navy bg-navy text-white'
                : 'border-slate-300 bg-white text-navy hover:bg-navy-50',
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {state === 'error' && items.length === 0 ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your requests"
          description="Refresh the page to try again."
        />
      ) : state === 'loading' && items.length === 0 ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title={filter ? 'No requests here' : 'No support requests yet'}
          description="If something is not right with an order, start a request and our team will help."
          action={
            <Link href="/account/support/new" className={primaryLink}>
              Start a request
            </Link>
          }
        />
      ) : (
        <>
          <ul className="space-y-3">
            {items.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={`/account/support/${ticket.id}`}
                  className={cn(
                    'block rounded-lg border border-slate-200 bg-white p-5 hover:border-teal/40',
                    focusRing,
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold text-navy">{ticket.subject}</p>
                    <TicketStatusChip status={ticket.status} />
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    #{ticket.ticketNumber} · {ticket.categoryLabel}
                    {ticket.order ? ` · Order #${ticket.order.orderNumber}` : ''} · Updated{' '}
                    {formatDateTime(ticket.lastMessageAt)}
                  </p>
                  {ticket.lastMessage && (
                    <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                      <span className="font-medium text-navy">
                        {ticket.lastMessage.authorType === 'CUSTOMER' ? 'You' : 'Trustlon Support'}:
                      </span>{' '}
                      {ticket.lastMessage.preview}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
          {page < totalPages && (
            <div className="mx-auto w-48">
              <Button
                variant="secondary"
                loading={state === 'loading'}
                onClick={() => setPage((p) => p + 1)}
              >
                Show more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** /account/support/new?order=:id */
export function NewTicket() {
  const params = useSearchParams();
  const router = useRouter();
  const descriptionId = useId();
  const [category, setCategory] = useState<TicketCategory | null>(null);
  const [subject, setSubject] = useState('');
  const [orderId, setOrderId] = useState(params.get('order') ?? '');
  const [description, setDescription] = useState('');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const uploads = useUploads({ max: 3, rules: FILE_RULES, upload: accountApi.uploadTicketFile });

  useEffect(() => {
    accountApi
      .orders({ pageSize: 20 })
      .then((result) => setOrders(result.items))
      .catch(() => setOrders([]));
    if (params.get('order')) setCategory('ORDER');
    // Read the link once on arrival.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!category) return setError('Choose what your request is about.');
    if (subject.trim().length < 5) return setError('Write a subject of at least 5 characters.');
    if (description.trim().length < 20)
      return setError('Describe the problem in at least 20 characters.');
    if (uploads.uploading) return setError('Wait for your files to finish uploading.');
    setSaving(true);
    try {
      const ticket = await accountApi.createTicket({
        category,
        subject: subject.trim(),
        orderId: UUID.test(orderId) ? orderId : undefined,
        description: description.trim(),
        attachmentIds: uploads.ids,
      });
      router.push(`/account/support/${ticket.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'We couldn’t send your request. Try again.',
      );
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <Link
        href="/account/support"
        className="inline-flex min-h-11 items-center text-sm text-teal-600"
      >
        ← All requests
      </Link>
      <PageHeader
        title="New support request"
        description="Tell us what happened. The more detail, the faster we can help."
      />
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <Panel>
          <div className="space-y-5">
            <fieldset>
              <legend className="mb-2 text-sm font-medium text-navy">What is it about?</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      'flex h-10 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-teal',
                      category === option.value
                        ? 'border-navy bg-navy text-white'
                        : 'border-slate-300 bg-white text-navy',
                    )}
                  >
                    <input
                      type="radio"
                      name="category"
                      value={option.value}
                      checked={category === option.value}
                      onChange={() => setCategory(option.value)}
                      className="sr-only"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <ListSelect
              label="Related order (optional)"
              value={orderId || 'NONE'}
              onChange={(next) => setOrderId(next === 'NONE' ? '' : next)}
              searchPlaceholder="Search by order number or item"
              options={[
                { value: 'NONE', label: 'Not about an order' },
                ...orders.map((order) => ({
                  value: order.id,
                  label: `#${order.orderNumber} · ${order.previewItems[0]?.name ?? ''}`,
                  detail: formatDate(order.placedAt),
                })),
              ]}
            />
            <TextField
              label="Subject"
              maxLength={120}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Received a damaged item"
            />
            <div>
              <label htmlFor={descriptionId} className="mb-1.5 block text-sm font-medium text-navy">
                Describe the problem
              </label>
              <textarea
                id={descriptionId}
                rows={6}
                maxLength={4000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass(false)} h-auto py-2`}
              />
              <p className="mt-1 text-end text-xs text-slate-500">{description.length}/4000</p>
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-navy">
                Attachments{' '}
                <span className="font-normal text-slate-500">
                  (optional, up to 3 images or PDFs, 5 MB each)
                </span>
              </p>
              <UploadTiles uploads={uploads} max={3} accept={FILE_ACCEPT} addLabel="Add file" />
            </div>
            {error && <Alert>{error}</Alert>}
            <div className="sm:w-56">
              <Button type="submit" loading={saving} disabled={uploads.uploading}>
                Send request
              </Button>
            </div>
          </div>
        </Panel>
        <Panel title="Before you write">
          <ul className="space-y-3 text-sm text-slate-600">
            <li>
              To <strong className="text-navy">cancel</strong> an item that has not shipped, open
              the order and choose Cancel item.
            </li>
            <li>
              To <strong className="text-navy">return</strong> a delivered item, open the order and
              choose Return items.
            </li>
            <li>
              Track refunds in{' '}
              <Link href="/account/returns" className="text-teal-600 hover:underline">
                Returns
              </Link>{' '}
              and{' '}
              <Link href="/account/wallet" className="text-teal-600 hover:underline">
                Wallet
              </Link>
              .
            </li>
            <li>Never share your password or OTP. Trustlon will never ask for them.</li>
          </ul>
        </Panel>
      </div>
    </form>
  );
}

function AttachmentLink({ file }: { file: { id: string; fileName: string; sizeBytes: number } }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          const blob = await accountApi.ticketFile(file.id);
          const url = URL.createObjectURL(blob);
          window.open(url, '_blank', 'noopener');
          window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-navy hover:bg-navy-50',
        focusRing,
      )}
    >
      <Icon name="bag" className="h-3.5 w-3.5 text-teal-600" />
      {file.fileName} · {Math.max(1, Math.round(file.sizeBytes / 1024))} KB
    </button>
  );
}

/** /account/support/:id: the conversation with support. */
export function TicketThread() {
  const { id } = useParams<{ id: string }>();
  const replyId = useId();
  const bottom = useRef<HTMLDivElement>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploads = useUploads({ max: 3, rules: FILE_RULES, upload: accountApi.uploadTicketFile });

  useEffect(() => {
    if (!UUID.test(id)) {
      setState('missing');
      return;
    }
    const controller = new AbortController();
    accountApi
      .ticket(id, controller.signal)
      .then((data) => {
        setTicket(data);
        setState('ready');
      })
      .catch((caught) => {
        if (controller.signal.aborted) return;
        setState(caught instanceof ApiError && caught.status === 404 ? 'missing' : 'error');
      });
    return () => controller.abort();
  }, [id]);

  const back = (
    <Link
      href="/account/support"
      className="inline-flex min-h-11 items-center text-sm text-teal-600"
    >
      ← All requests
    </Link>
  );

  if (state === 'missing') {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState title="We couldn’t find this request" />
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="space-y-4">
        {back}
        <EmptyState
          role="alert"
          title="We couldn’t load this request"
          description="Refresh the page to try again."
        />
      </div>
    );
  }
  if (!ticket) {
    return (
      <div className="space-y-4" aria-busy="true">
        {back}
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!reply.trim()) return setError('Write a message.');
    if (uploads.uploading) return setError('Wait for your files to finish uploading.');
    setSending(true);
    try {
      setTicket(await accountApi.replyTicket(ticket.id, reply.trim(), uploads.ids));
      setReply('');
      uploads.setItems([]);
      window.setTimeout(() => bottom.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'We couldn’t send your message. Try again.',
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      {back}
      <PageHeader
        title={ticket.subject}
        description={`#${ticket.ticketNumber} · ${ticket.categoryLabel} · opened ${formatDate(ticket.createdAt)}`}
        action={<TicketStatusChip status={ticket.status} />}
      />
      {ticket.order && (
        <p className="text-sm text-slate-600">
          About order{' '}
          <Link
            href={`/account/orders/${ticket.order.id}`}
            className="font-medium text-teal-600 hover:underline"
          >
            #{ticket.order.orderNumber}
          </Link>
        </p>
      )}

      <Panel>
        <ol className="space-y-4" aria-label="Conversation">
          {ticket.messages.map((message) =>
            message.authorType === 'SYSTEM' ? (
              <li key={message.id} className="text-center text-xs text-slate-500">
                {message.body} · {formatDateTime(message.createdAt)}
              </li>
            ) : (
              <li
                key={message.id}
                className={cn(
                  'flex',
                  message.authorType === 'CUSTOMER' ? 'justify-end' : 'justify-start',
                )}
              >
                <div
                  className={cn(
                    'max-w-[85%] rounded-lg px-4 py-3 text-sm sm:max-w-[70%]',
                    message.authorType === 'CUSTOMER'
                      ? 'bg-navy text-white'
                      : 'border border-slate-200 bg-navy-50 text-navy',
                  )}
                >
                  <p
                    className={cn(
                      'text-xs font-semibold',
                      message.authorType === 'CUSTOMER' ? 'text-white/80' : 'text-teal-600',
                    )}
                  >
                    {message.authorType === 'CUSTOMER' ? 'You' : message.authorName}
                  </p>
                  <p className="mt-1 whitespace-pre-line">{message.body}</p>
                  {message.attachments.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.attachments.map((file) => (
                        <AttachmentLink key={file.id} file={file} />
                      ))}
                    </div>
                  )}
                  <p
                    className={cn(
                      'mt-2 text-[11px]',
                      message.authorType === 'CUSTOMER' ? 'text-white/60' : 'text-slate-500',
                    )}
                  >
                    {formatDateTime(message.createdAt)}
                  </p>
                </div>
              </li>
            ),
          )}
        </ol>
        <div ref={bottom} />
      </Panel>

      {ticket.canReply ? (
        <Panel title={ticket.status === 'RESOLVED' ? 'Still need help? Reply to reopen' : 'Reply'}>
          <form onSubmit={send} noValidate className="space-y-4">
            <label htmlFor={replyId} className="sr-only">
              Your message
            </label>
            <textarea
              id={replyId}
              rows={4}
              maxLength={4000}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Write your message"
              className={`${inputClass(false)} h-auto py-2`}
            />
            <UploadTiles uploads={uploads} max={3} accept={FILE_ACCEPT} addLabel="Add file" />
            {error && <Alert>{error}</Alert>}
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:w-48">
                <Button type="submit" loading={sending} disabled={uploads.uploading}>
                  Send
                </Button>
              </div>
              {ticket.canClose && (
                <button
                  type="button"
                  className={secondaryAction}
                  onClick={async () => {
                    try {
                      setTicket(await accountApi.resolveTicket(ticket.id));
                    } catch {
                      setError('We couldn’t update this request. Try again.');
                    }
                  }}
                >
                  <Icon name="check" className="h-4 w-4" />
                  My problem is solved
                </button>
              )}
            </div>
          </form>
        </Panel>
      ) : (
        <Alert tone="info">
          <span>
            This request is closed. If you still need help,{' '}
            <Link href="/account/support/new" className="font-semibold underline">
              start a new request
            </Link>{' '}
            and mention #{ticket.ticketNumber}.
          </span>
        </Alert>
      )}
    </div>
  );
}
