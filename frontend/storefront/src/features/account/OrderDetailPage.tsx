'use client';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Alert, Button, cn, focusRing, typography } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ApiError } from '@/lib/http';
import { formatInternational } from '@/lib/phone';
import { accountApi } from './api';
import { CancelDialog } from './components/CancelDialog';
import { TrackingTimeline } from './components/TrackingTimeline';
import { Panel, ReturnStatusChip, Skeleton, StatusChip, Thumb } from './components/ui';
import { deliveryNote, formatDate, formatDateTime, formatMoney, PAYMENT_LABELS } from './format';
import type { OrderDetail, SubOrder } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const secondaryAction = cn(
  'inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-navy hover:bg-navy-50 disabled:cursor-not-allowed disabled:opacity-60',
  focusRing,
);

function InvoiceButton({ subOrder }: { subOrder: SubOrder }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!subOrder.invoice) return null;
  const invoice = subOrder.invoice;
  return (
    <div>
      <button
        type="button"
        className={secondaryAction}
        disabled={busy}
        aria-busy={busy || undefined}
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await accountApi.downloadInvoice(subOrder.id, invoice.number);
          } catch (caught) {
            setError(
              caught instanceof ApiError && caught.message
                ? caught.message
                : 'We couldn’t download the invoice. Try again.',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="arrow" className="h-4 w-4 rotate-90" />
        {busy ? 'Preparing invoice…' : 'Download invoice'}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}

function SubOrderPanel({
  subOrder,
  index,
  count,
  onCancel,
}: {
  subOrder: SubOrder;
  index: number;
  count: number;
  onCancel: () => void;
}) {
  const { shipment, refund, cancellation, actions } = subOrder;
  return (
    <Panel as="article" padded={false}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            {count > 1 ? `Shipment ${index + 1} of ${count}` : 'Shipment'} ·{' '}
            {subOrder.subOrderNumber}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-navy">
            Sold by <span className="font-semibold">{subOrder.seller.name}</span>
            {subOrder.seller.isVerified && (
              <span className="inline-flex items-center gap-1 text-xs text-teal-600">
                <Icon name="shield" className="h-3.5 w-3.5" />
                Verified
              </span>
            )}
          </p>
        </div>
        <div className="sm:text-right">
          <StatusChip status={subOrder.status} />
          <p className="mt-1 text-xs text-slate-500">
            {deliveryNote({ ...shipment, status: subOrder.status })}
          </p>
        </div>
      </header>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <ul className="space-y-4">
          {subOrder.items.map((item) => (
            <li key={item.id} className="flex gap-4">
              <Thumb src={item.image} alt="" className="h-20 w-20" />
              <div className="min-w-0 flex-1">
                {item.brand && (
                  <p className="text-xs uppercase tracking-wider text-slate-500">{item.brand}</p>
                )}
                <p className="font-medium text-navy">{item.name}</p>
                <p className="mt-1 text-sm text-slate-500">Qty {item.quantity}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold text-navy">{formatMoney(item.totalPaise)}</p>
                {item.unitMrpPaise > item.unitPricePaise && (
                  <p className="text-xs text-slate-500 line-through">
                    {formatMoney(item.unitMrpPaise * item.quantity)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        <div className="grid gap-6 border-t border-slate-100 pt-5 md:grid-cols-2">
          <div className="min-w-0 space-y-4">
            {cancellation && (
              <Alert tone="info">
                <span>
                  Cancelled on {formatDateTime(cancellation.cancelledAt)}
                  {cancellation.reason ? `. Reason: ${cancellation.reason}` : ''}
                </span>
              </Alert>
            )}

            {refund && (
              <div className="rounded-lg border border-slate-200 p-4 text-sm">
                <p className="font-semibold text-navy">
                  {refund.status === 'PROCESSED' ? 'Refund completed' : 'Refund in progress'} ·{' '}
                  {formatMoney(refund.amountPaise)}
                </p>
                <p className="mt-1 text-slate-500">
                  To {refund.destination}
                  {refund.status === 'PROCESSED' && refund.refundedAt
                    ? ` on ${formatDate(refund.refundedAt)}`
                    : '. Banks usually take 5 to 7 business days.'}
                </p>
                {refund.reference && (
                  <p className="mt-1 text-xs text-slate-500">Reference {refund.reference}</p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-start gap-3">
              {actions.canCancel && (
                <button type="button" onClick={onCancel} className={secondaryAction}>
                  <Icon name="close" className="h-4 w-4" />
                  Cancel item
                </button>
              )}
              {actions.returnEligibleUntil && (
                <Link
                  href={`/account/returns/new?subOrder=${subOrder.id}`}
                  className={secondaryAction}
                >
                  <Icon name="return" className="h-4 w-4" />
                  Return items
                </Link>
              )}
              <InvoiceButton subOrder={subOrder} />
              <Link href="/browse/help" className={secondaryAction}>
                Need help?
              </Link>
            </div>
            {actions.returnEligibleUntil && (
              <p className="flex items-center gap-2 text-sm text-slate-600">
                <Icon name="return" className="h-4 w-4 text-teal-600" />
                Eligible for return until {formatDate(actions.returnEligibleUntil)}
              </p>
            )}
            {subOrder.returns.length > 0 && (
              <ul className="space-y-1 text-sm">
                {subOrder.returns.map((item) => (
                  <li key={item.id} className="flex flex-wrap items-center gap-2">
                    <ReturnStatusChip status={item.status} />
                    <Link
                      href={`/account/returns/${item.id}`}
                      className="text-teal-600 hover:underline"
                    >
                      Return #{item.returnNumber}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            {actions.canCancel && (
              <p className="text-xs text-slate-500">
                You can cancel this item until the seller ships it.
              </p>
            )}
          </div>

          <div className="md:border-l md:border-slate-100 md:pl-6">
            <h3 className="mb-3 text-sm font-semibold text-navy">Tracking</h3>
            {shipment.awb && (
              <p className="mb-3 text-xs text-slate-500">
                {shipment.courierName} · AWB{' '}
                <span className="font-medium text-navy">{shipment.awb}</span>
              </p>
            )}
            <TrackingTimeline status={subOrder.status} events={shipment.events} />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PaymentBreakup({ order }: { order: OrderDetail }) {
  const b = order.breakup;
  const rows: Array<[string, string, string?]> = [
    ['Price (MRP)', formatMoney(b.mrpTotalPaise)],
    ...(b.productDiscountPaise > 0
      ? ([['Discount', `− ${formatMoney(b.productDiscountPaise)}`, 'text-teal-600']] as Array<
          [string, string, string]
        >)
      : []),
    ...(b.couponDiscountPaise > 0
      ? ([
          [
            `Coupon${b.couponCode ? ` (${b.couponCode})` : ''}`,
            `− ${formatMoney(b.couponDiscountPaise)}`,
            'text-teal-600',
          ],
        ] as Array<[string, string, string]>)
      : []),
    ['Delivery', b.deliveryPaise > 0 ? formatMoney(b.deliveryPaise) : 'Free'],
  ];
  return (
    <Panel title="Payment summary">
      <dl className="space-y-2 text-sm">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-slate-500">{label}</dt>
            <dd className={cn('text-navy', tone)}>{value}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t border-slate-100 pt-3 text-base font-semibold">
          <dt className="text-navy">Order total</dt>
          <dd className="text-navy">{formatMoney(b.totalPaise)}</dd>
        </div>
        <p className="text-xs text-slate-500">Includes {formatMoney(b.taxPaise)} GST</p>
        {b.refundStatus !== 'NONE' && (
          <div className="flex justify-between gap-4 border-t border-slate-100 pt-3">
            <dt className="text-slate-500">
              {b.refundStatus === 'PROCESSED' ? 'Refunded' : 'Refund in progress'}
            </dt>
            <dd className="font-semibold text-navy">{formatMoney(b.refundedPaise)}</dd>
          </div>
        )}
      </dl>
      <div className="mt-4 rounded-lg bg-navy-50 p-3 text-xs text-navy">
        Payment method: {PAYMENT_LABELS[order.payment.method]}
        {order.payment.method === 'COD' && order.payment.status === 'PENDING'
          ? ' (pay when it arrives)'
          : ''}
      </div>
    </Panel>
  );
}

function AddressCard({ order }: { order: OrderDetail }) {
  const a = order.shippingAddress;
  return (
    <Panel title="Delivery address">
      <address className="text-sm not-italic leading-6 text-navy">
        <span className="font-semibold">{a.name}</span>
        <br />
        {a.line1}
        {a.line2 && (
          <>
            <br />
            {a.line2}
          </>
        )}
        {a.landmark && (
          <>
            <br />
            {a.landmark}
          </>
        )}
        <br />
        {a.city}, {a.state} {a.pincode}
        {a.mobile && (
          <>
            <br />
            <span className="text-slate-500">Mobile {formatInternational(a.mobile)}</span>
          </>
        )}
      </address>
    </Panel>
  );
}

/** /account/orders/:id: each seller's shipment with tracking, actions and the payment summary. */
export function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [cancelling, setCancelling] = useState<SubOrder | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!UUID.test(id)) {
      setState('missing');
      return;
    }
    const controller = new AbortController();
    setState('loading');
    accountApi
      .order(id, controller.signal)
      .then((data) => {
        setOrder(data);
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
      href="/account/orders"
      className="inline-flex min-h-11 items-center gap-1 text-sm text-teal-600"
    >
      ← All orders
    </Link>
  );

  if (state === 'missing') {
    return (
      <div className="space-y-4">
        {back}
        <Panel>
          <h1 className={typography.pageTitle}>We couldn’t find this order</h1>
          <p className="mt-2 text-slate-500">
            Check the link, or find the order in your order list.
          </p>
        </Panel>
      </div>
    );
  }

  if (state === 'error' && !order) {
    return (
      <div className="space-y-4">
        {back}
        <div role="alert" className="rounded-lg border border-slate-200 bg-white p-8 text-center">
          <p className="text-slate-500">We couldn’t load this order.</p>
          <div className="mx-auto mt-4 w-40">
            <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="space-y-4" aria-busy="true">
        {back}
        <Skeleton className="h-10 w-72" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={typography.pageTitle}>Order #{order.orderNumber}</h1>
          <p className="mt-1 text-slate-500">
            Placed on {formatDate(order.placedAt)} · {order.subOrders.length}{' '}
            {order.subOrders.length === 1 ? 'shipment' : 'shipments'}
          </p>
        </div>
      </div>

      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {order.subOrders.map((subOrder, index) => (
            <SubOrderPanel
              key={subOrder.id}
              subOrder={subOrder}
              index={index}
              count={order.subOrders.length}
              onCancel={() => {
                setNotice(null);
                setCancelling(subOrder);
              }}
            />
          ))}
        </div>
        <div className="space-y-6">
          <PaymentBreakup order={order} />
          <AddressCard order={order} />
        </div>
      </div>

      {cancelling && (
        <CancelDialog
          order={order}
          subOrder={cancelling}
          open={Boolean(cancelling)}
          onClose={() => setCancelling(null)}
          onCancelled={(updated) => {
            setOrder(updated);
            setCancelling(null);
            const refund = updated.subOrders.find((sub) => sub.id === cancelling.id)?.refund;
            setNotice(
              refund
                ? `Item cancelled. ${formatMoney(refund.amountPaise)} ${
                    refund.status === 'PROCESSED' ? 'has been refunded' : 'will be refunded'
                  } to ${refund.destination}.`
                : 'Item cancelled.',
            );
          }}
        />
      )}
    </div>
  );
}
