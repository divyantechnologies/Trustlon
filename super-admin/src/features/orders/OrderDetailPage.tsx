'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Badge,
  Btn,
  Card,
  ErrorState,
  KeyValues,
  Loading,
  NumberInput,
  PageHeader,
  ReasonDialog,
  StatusBadge,
  TextArea,
  useAction,
} from '@/components/ui';
import { Checkbox, ListSelect, TextField, focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import { apiFetch } from '@/lib/http';
import { date, dateTime, humanize, money } from '@/lib/format';
import { useApi } from '@/lib/use-api';

interface SubOrder {
  id: string;
  subOrderNumber: string;
  vendor: { id: string; displayName: string; slug: string };
  status: string;
  cancellable: boolean;
  inTransit: boolean;
  totalPaise: number;
  itemsTotalPaise: number;
  deliveryPaise: number;
  taxPaise: number;
  courierName: string | null;
  awb: string | null;
  expectedDeliveryAt: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  invoiceNumber: string | null;
  invoicedAt: string | null;
  refund: {
    status: string | null;
    amountPaise: number;
    reference: string | null;
    at: string | null;
  };
  refundablePaise: number;
  items: Array<{
    id: string;
    productId: string | null;
    name: string;
    slug: string | null;
    imageUrl: string | null;
    quantity: number;
    unitPricePaise: number;
    gstRatePercent: number;
    hsnCode: string | null;
  }>;
  returns: Array<{
    id: string;
    returnNumber: string;
    status: string;
    refundAmountPaise: number;
    requestedAt: string;
    reason: string;
  }>;
}

interface OrderDetail {
  id: string;
  orderNumber: string;
  placedAt: string;
  customer: {
    id: string;
    fullName: string;
    mobile: string;
    email: string;
    status: string;
    codDisabled: boolean;
  };
  stage: string;
  payment: {
    method: string;
    status: string;
    reference: string | null;
    mrpTotalPaise: number;
    itemsTotalPaise: number;
    couponCode: string | null;
    couponDiscountPaise: number;
    deliveryPaise: number;
    taxPaise: number;
    totalPaise: number;
    refundedPaise: number;
  };
  shippingAddress: Record<string, string | null> | null;
  subOrders: SubOrder[];
  notes: Array<{ id: string; body: string; by: string; at: string }>;
  tickets: Array<{
    id: string;
    ticketNumber: string;
    subject: string;
    status: string;
    createdAt: string;
  }>;
  timeline: Array<{ at: string; title: string; detail: string; kind: string }>;
}

interface ShippingSettings {
  value: { couriers: Array<{ code: string; name: string; enabled: boolean }> };
}

type Dialog =
  | null
  | 'cancel'
  | { kind: 'refund'; sub: SubOrder }
  | { kind: 'courier'; sub: SubOrder };

const KIND_DOT: Record<string, string> = {
  order: 'bg-navy',
  shipment: 'bg-teal',
  return: 'bg-amber-500',
  refund: 'bg-teal-600',
  note: 'bg-slate-400',
};

function addressText(a: OrderDetail['shippingAddress']) {
  if (!a) return '—';
  return [
    a.fullName,
    a.line1,
    a.line2,
    a.landmark,
    [a.city, a.state, a.pincode].filter(Boolean).join(', '),
    a.country,
    a.mobile,
  ]
    .filter(Boolean)
    .join('\n');
}

/** Order detail (5.5): parent order, sub-orders, payment, shipments, refunds, timeline and admin actions. */
export function OrderDetailPage({ id }: { id: string }) {
  const { can } = useAuth();
  const run = useAction();
  const { data: o, error, reload, setData } = useApi<OrderDetail>(`/admin/orders/${id}`);
  const { data: shipping } = useApi<ShippingSettings>(
    can('orders:edit') ? '/admin/settings/shipping' : null,
  );
  const [dialog, setDialog] = useState<Dialog>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [refundAmount, setRefundAmount] = useState<number | null>(null);
  const [refundMethod, setRefundMethod] = useState<'ORIGINAL' | 'WALLET'>('ORIGINAL');
  const [courier, setCourier] = useState('');
  const [awb, setAwb] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (error) return <ErrorState error={error} onRetry={reload} />;
  if (!o) return <Loading />;

  const cancellable = o.subOrders.filter((s) => s.cancellable);
  const couriers = shipping?.value.couriers.filter((c) => c.enabled) ?? [];
  const refundSub =
    dialog && typeof dialog === 'object' && dialog.kind === 'refund' ? dialog.sub : null;
  const courierSub =
    dialog && typeof dialog === 'object' && dialog.kind === 'courier' ? dialog.sub : null;
  const refundMax = refundSub ? refundSub.refundablePaise / 100 : 0;

  return (
    <div>
      <PageHeader
        back={{ href: '/orders', label: 'Orders' }}
        title={<span className="font-mono">{o.orderNumber}</span>}
        meta={
          <>
            <StatusBadge value={o.stage} />
            <StatusBadge
              value={o.payment.status}
              label={`${o.payment.method === 'COD' ? 'COD' : humanize(o.payment.method)} · ${humanize(o.payment.status)}`}
            />
            <span className="text-sm text-slate-500">Placed {dateTime(o.placedAt)}</span>
          </>
        }
        actions={
          can('orders:edit') &&
          cancellable.length > 0 && (
            <Btn
              tone="danger"
              size="sm"
              onClick={() => {
                setSelected(cancellable.map((s) => s.id));
                setDialog('cancel');
              }}
            >
              Cancel order
            </Btn>
          )
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-5">
          {o.subOrders.map((sub) => (
            <Card
              key={sub.id}
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-sm">{sub.subOrderNumber}</span>
                  <StatusBadge value={sub.status} />
                </span>
              }
              description={
                <>
                  Sold by{' '}
                  <Link
                    href={`/vendors/${sub.vendor.id}`}
                    className="text-teal-600 hover:underline"
                  >
                    {sub.vendor.displayName}
                  </Link>
                </>
              }
              actions={
                <>
                  {can('orders:edit') && sub.inTransit && (
                    <Btn
                      size="sm"
                      onClick={() => {
                        setCourier('');
                        setAwb('');
                        setDialog({ kind: 'courier', sub });
                      }}
                    >
                      Change courier
                    </Btn>
                  )}
                  {can('orders:approve') &&
                    sub.refundablePaise > 0 &&
                    o.payment.status !== 'PENDING' && (
                      <Btn
                        size="sm"
                        onClick={() => {
                          setRefundAmount(sub.refundablePaise / 100);
                          setRefundMethod(o.payment.method === 'COD' ? 'WALLET' : 'ORIGINAL');
                          setDialog({ kind: 'refund', sub });
                        }}
                      >
                        Refund
                      </Btn>
                    )}
                </>
              }
            >
              <ul className="divide-y divide-slate-100">
                {sub.items.map((item) => (
                  <li key={item.id} className="flex gap-3 py-2 first:pt-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="h-14 w-14 shrink-0 rounded-lg border border-slate-200 object-cover"
                      />
                    ) : (
                      <span aria-hidden className="h-14 w-14 shrink-0 rounded-lg bg-slate-100" />
                    )}
                    <div className="min-w-0 flex-1">
                      {item.productId ? (
                        <Link
                          href={`/catalog/products/${item.productId}`}
                          className="break-words text-sm font-medium text-navy hover:text-teal-600"
                        >
                          {item.name}
                        </Link>
                      ) : (
                        <p className="break-words text-sm font-medium text-navy">{item.name}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        Qty {item.quantity} · {money(item.unitPricePaise)} each · GST{' '}
                        {item.gstRatePercent}%{item.hsnCode ? ` · HSN ${item.hsnCode}` : ''}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm tabular-nums text-navy">
                      {money(item.unitPricePaise * item.quantity)}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-slate-100 pt-3">
                <KeyValues
                  columns={3}
                  items={[
                    ['Sub-order total', money(sub.totalPaise)],
                    [
                      'Courier',
                      sub.courierName ? `${sub.courierName}${sub.awb ? ` · ${sub.awb}` : ''}` : '—',
                    ],
                    ['Expected delivery', date(sub.expectedDeliveryAt)],
                    ['Shipped', dateTime(sub.shippedAt)],
                    ['Delivered', dateTime(sub.deliveredAt)],
                    [
                      'Invoice',
                      sub.invoiceNumber ? `${sub.invoiceNumber} · ${date(sub.invoicedAt)}` : '—',
                    ],
                    ...(sub.cancelledAt
                      ? ([
                          [
                            'Cancelled',
                            `${dateTime(sub.cancelledAt)} by ${humanize(sub.cancelledBy ?? '')}${sub.cancelReason ? ` · ${sub.cancelReason}` : ''}`,
                          ],
                        ] as Array<[string, string]>)
                      : []),
                    ...(sub.refund.amountPaise > 0
                      ? ([
                          [
                            'Refunded',
                            `${money(sub.refund.amountPaise)} · ${humanize(sub.refund.status ?? '')}${sub.refund.reference ? ` · ${sub.refund.reference}` : ''}`,
                          ],
                        ] as Array<[string, string]>)
                      : []),
                  ]}
                />
                {sub.returns.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {sub.returns.map((r) => (
                      <Badge key={r.id} tone="warning">
                        Return {r.returnNumber} · {humanize(r.status)}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}

          <Card title="Timeline">
            <ol className="relative space-y-4 border-s border-slate-200 ps-5">
              {o.timeline.map((event, index) => (
                <li key={`${event.at}-${index}`} className="relative">
                  <span
                    aria-hidden
                    className={cn(
                      'absolute -start-[26px] top-1.5 h-2.5 w-2.5 rounded-full ring-4 ring-white',
                      KIND_DOT[event.kind] ?? 'bg-slate-400',
                    )}
                  />
                  <p className="text-sm font-medium text-navy">{event.title}</p>
                  {event.detail && (
                    <p className="whitespace-pre-line break-words text-xs text-slate-500">
                      {event.detail}
                    </p>
                  )}
                  <p className="text-xs text-slate-400">{dateTime(event.at)}</p>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          <Card title="Customer">
            <p className="font-medium text-navy">
              <Link
                href={`/customers/${o.customer.id}`}
                className="hover:text-teal-600 hover:underline"
              >
                {o.customer.fullName}
              </Link>
            </p>
            <p className="text-sm text-slate-600">{o.customer.mobile}</p>
            <p className="break-all text-sm text-slate-600">{o.customer.email}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {o.customer.status !== 'ACTIVE' && <StatusBadge value={o.customer.status} />}
              {o.customer.codDisabled && <Badge tone="warning">COD disabled</Badge>}
            </div>
            <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Ship to
            </h3>
            <p className="mt-1 whitespace-pre-line text-sm text-navy">
              {addressText(o.shippingAddress)}
            </p>
          </Card>

          <Card title="Payment">
            <dl className="space-y-1.5 text-sm">
              {(
                [
                  ['MRP total', money(o.payment.mrpTotalPaise)],
                  ['Items', money(o.payment.itemsTotalPaise)],
                  ...(o.payment.couponDiscountPaise
                    ? ([
                        [
                          `Coupon ${o.payment.couponCode ?? ''}`,
                          `−${money(o.payment.couponDiscountPaise)}`,
                        ],
                      ] as Array<[string, string]>)
                    : []),
                  ['Delivery', money(o.payment.deliveryPaise)],
                  ['Tax (included)', money(o.payment.taxPaise)],
                ] as Array<[string, string]>
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-slate-500">{k}</dt>
                  <dd className="tabular-nums text-navy">{v}</dd>
                </div>
              ))}
              <div className="flex justify-between gap-3 border-t border-slate-100 pt-2 font-semibold">
                <dt className="text-navy">Total</dt>
                <dd className="tabular-nums text-navy">{money(o.payment.totalPaise)}</dd>
              </div>
              {o.payment.refundedPaise > 0 && (
                <div className="flex justify-between gap-3 text-teal-600">
                  <dt>Refunded</dt>
                  <dd className="tabular-nums">{money(o.payment.refundedPaise)}</dd>
                </div>
              )}
            </dl>
            <p className="mt-3 break-all text-xs text-slate-500">
              Reference: {o.payment.reference ?? '—'}
            </p>
          </Card>

          {o.tickets.length > 0 && (
            <Card title="Support tickets">
              <ul className="space-y-2 text-sm">
                {o.tickets.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-mono text-xs text-slate-500">{t.ticketNumber}</span>
                      <span className="block break-words text-navy">{t.subject}</span>
                    </span>
                    <StatusBadge value={t.status} />
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <Card title="Internal notes" description="Only staff see these.">
            {can('orders:edit') && (
              <form
                className="mb-4 space-y-2"
                onSubmit={async (event) => {
                  event.preventDefault();
                  if (note.trim().length < 2) return;
                  setSaving(true);
                  const result = await run(
                    () =>
                      apiFetch<OrderDetail>(`/admin/orders/${o.id}/notes`, {
                        method: 'POST',
                        body: { body: note.trim() },
                      }),
                    'Note added',
                  );
                  setSaving(false);
                  if (result) {
                    setData(result);
                    setNote('');
                  }
                }}
              >
                <TextArea
                  label="Add a note"
                  value={note}
                  onChange={setNote}
                  maxLength={1000}
                  rows={2}
                />
                <Btn
                  type="submit"
                  size="sm"
                  tone="primary"
                  loading={saving}
                  disabled={note.trim().length < 2}
                >
                  Add note
                </Btn>
              </form>
            )}
            {o.notes.length === 0 ? (
              <p className="text-sm text-slate-500">No notes yet.</p>
            ) : (
              <ul className="space-y-3">
                {o.notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-slate-50 p-3">
                    <p className="whitespace-pre-line break-words text-sm text-navy">{n.body}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {n.by} · {dateTime(n.at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <ReasonDialog
        open={dialog === 'cancel'}
        title="Cancel order"
        tone="danger"
        confirmLabel="Cancel selected"
        description="Paid amounts go back the way the customer paid. Shipped parcels can’t be cancelled here."
        canConfirm={selected.length > 0}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          const result = await apiFetch<OrderDetail>(`/admin/orders/${o.id}/cancel`, {
            method: 'POST',
            body: { reason, subOrderIds: selected },
          });
          setData(result);
        }}
      >
        <fieldset className="space-y-2">
          <legend className="mb-1 text-sm font-medium text-navy">Sub-orders to cancel</legend>
          {cancellable.map((s) => (
            <Checkbox
              key={s.id}
              checked={selected.includes(s.id)}
              onChange={(e) =>
                setSelected((cur) =>
                  e.target.checked ? [...cur, s.id] : cur.filter((x) => x !== s.id),
                )
              }
              label={`${s.subOrderNumber} · ${s.vendor.displayName} · ${money(s.totalPaise)}`}
            />
          ))}
        </fieldset>
      </ReasonDialog>

      <ReasonDialog
        open={Boolean(refundSub)}
        title={`Refund ${refundSub?.subOrderNumber ?? ''}`}
        confirmLabel="Start refund"
        description={
          refundSub
            ? `Up to ${money(refundSub.refundablePaise)} can still be refunded on this sub-order.`
            : undefined
        }
        canConfirm={refundAmount !== null && refundAmount >= 1 && refundAmount <= refundMax}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (!refundSub || refundAmount === null) return;
          const result = await apiFetch<OrderDetail>(`/admin/orders/${o.id}/refund`, {
            method: 'POST',
            body: {
              reason,
              subOrderId: refundSub.id,
              amountRupees: refundAmount,
              method: refundMethod,
            },
          });
          setData(result);
        }}
      >
        <NumberInput
          label="Amount"
          unit="₹"
          value={refundAmount}
          onChange={setRefundAmount}
          min={1}
          max={refundMax}
          step={0.01}
        />
        <ListSelect
          label="Refund to"
          value={refundMethod}
          onChange={(value) => setRefundMethod(value as 'ORIGINAL' | 'WALLET')}
          options={[
            ...(o.payment.method === 'COD'
              ? []
              : [{ value: 'ORIGINAL' as const, label: 'Original payment method' }]),
            { value: 'WALLET' as const, label: 'Trustlon wallet', detail: 'instant' },
          ]}
        />
      </ReasonDialog>

      <ReasonDialog
        open={Boolean(courierSub)}
        title={`Change courier for ${courierSub?.subOrderNumber ?? ''}`}
        confirmLabel="Change courier"
        canConfirm={Boolean(courier) && /^[A-Z0-9-]{6,40}$/.test(awb.trim().toUpperCase())}
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (!courierSub) return;
          const result = await apiFetch<OrderDetail>(`/admin/orders/${o.id}/reassign-courier`, {
            method: 'POST',
            body: {
              reason,
              subOrderId: courierSub.id,
              courierCode: courier,
              awb: awb.trim().toUpperCase(),
            },
          });
          setData(result);
        }}
      >
        {courierSub?.courierName && (
          <p className="text-sm text-slate-600">
            Now: {courierSub.courierName} · {courierSub.awb ?? 'no AWB'}
          </p>
        )}
        <ListSelect
          label="New courier"
          value={courier}
          onChange={setCourier}
          options={couriers.map((c) => ({ value: c.code, label: c.name }))}
          placeholder="Choose a courier"
        />
        <TextField
          label="New AWB (tracking number)"
          value={awb}
          onChange={(e) => setAwb(e.target.value)}
          maxLength={40}
          className={cn('uppercase', focusRing)}
        />
      </ReasonDialog>
    </div>
  );
}
