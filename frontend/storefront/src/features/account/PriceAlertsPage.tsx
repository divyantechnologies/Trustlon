'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert, Button, cn } from '@/design-system';
import { useHome } from '@/features/home/home-provider';
import { ApiError } from '@/lib/http';
import { accountApi } from './api';
import { PriceAlertDialog } from './components/PriceAlertDialog';
import {
  EmptyState,
  PageHeader,
  primaryLink,
  secondaryAction,
  Skeleton,
  Thumb,
} from './components/ui';
import { formatDate, formatMoney } from './format';
import type { PriceAlert } from './types';

function AlertRow({
  alert,
  busy,
  onEdit,
  onToggle,
  onRemove,
}: {
  alert: PriceAlert;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const home = useHome();
  const product = alert.product;
  const gap = product ? product.pricePaise - alert.targetPricePaise : 0;
  return (
    <li className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 sm:flex-row sm:items-center">
      {product ? (
        <button
          type="button"
          onClick={() => home.viewProduct(product)}
          className="shrink-0 rounded-lg"
          aria-label={`View ${product.name}`}
        >
          <Thumb src={product.image} alt="" className="h-20 w-20" />
        </button>
      ) : (
        <span className="h-20 w-20 shrink-0 rounded-lg bg-slate-100" aria-hidden />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-navy">
            {product?.name ?? 'This product is no longer sold'}
          </p>
          {alert.reached ? (
            <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-600">
              Price dropped
            </span>
          ) : alert.status === 'PAUSED' ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600">
              Paused
            </span>
          ) : null}
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:flex sm:flex-wrap">
          <div>
            <dt className="inline text-slate-500">Your target </dt>
            <dd className="inline font-semibold text-navy">
              {formatMoney(alert.targetPricePaise)}
            </dd>
          </div>
          {product && (
            <div>
              <dt className="inline text-slate-500">Today </dt>
              <dd
                className={cn(
                  'inline font-semibold',
                  alert.reached ? 'text-teal-600' : 'text-navy',
                )}
              >
                {formatMoney(product.pricePaise)}
              </dd>
            </div>
          )}
        </dl>
        <p className="mt-1 text-xs text-slate-500">
          {alert.reached
            ? 'Buy now while the price lasts.'
            : product
              ? `${formatMoney(gap)} to go · set on ${formatDate(alert.createdAt)}`
              : 'Remove this alert to keep your list tidy.'}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {product && alert.reached && (
          <button
            type="button"
            className={primaryLink}
            disabled={busy || !product.inStock}
            onClick={() => void home.addToCart(product)}
          >
            {product.inStock ? 'Add to cart' : 'Out of stock'}
          </button>
        )}
        {product && (
          <button type="button" className={secondaryAction} onClick={onEdit} disabled={busy}>
            Edit
          </button>
        )}
        {product && (
          <button type="button" className={secondaryAction} onClick={onToggle} disabled={busy}>
            {alert.status === 'PAUSED' ? 'Resume' : 'Pause'}
          </button>
        )}
        <button type="button" className={secondaryAction} onClick={onRemove} disabled={busy}>
          Remove
        </button>
      </div>
    </li>
  );
}

/** /account/price-alerts (spec 3.4). */
export function PriceAlertsPage() {
  const [items, setItems] = useState<PriceAlert[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [editing, setEditing] = useState<PriceAlert | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFailed(false);
    accountApi
      .priceAlerts()
      .then((result) => setItems(result.items))
      .catch(() => setFailed(true));
  }, [attempt]);

  const run = async (id: string, action: () => Promise<{ items: PriceAlert[] }>) => {
    setBusyId(id);
    setError(null);
    try {
      setItems((await action()).items);
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.message
          ? caught.message
          : 'Something went wrong. Try again.',
      );
    } finally {
      setBusyId(null);
    }
  };

  const reached = items?.filter((alert) => alert.reached).length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price alerts"
        description="We watch prices for you. Set alerts from your wishlist."
        action={
          <Link href="/account/wishlist" className={secondaryAction}>
            Go to wishlist
          </Link>
        }
      />
      {reached > 0 && (
        <Alert tone="success">
          {reached === 1 ? '1 product has' : `${reached} products have`} dropped to your target
          price.
        </Alert>
      )}
      {error && <Alert>{error}</Alert>}

      {failed && !items ? (
        <EmptyState
          role="alert"
          title="We couldn’t load your price alerts"
          action={
            <div className="w-40">
              <Button variant="secondary" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          }
        />
      ) : !items ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-28" />
          <Skeleton className="h-28" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No price alerts yet"
          description="Open your wishlist and choose “Set price alert” on any product."
          action={
            <Link href="/account/wishlist" className={primaryLink}>
              Open wishlist
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {items.map((alert) => (
            <AlertRow
              key={alert.id}
              alert={alert}
              busy={busyId === alert.id}
              onEdit={() => setEditing(alert)}
              onToggle={() =>
                run(alert.id, () =>
                  accountApi.updatePriceAlert(alert.id, {
                    status: alert.status === 'PAUSED' ? 'ACTIVE' : 'PAUSED',
                  }),
                )
              }
              onRemove={() => run(alert.id, () => accountApi.removePriceAlert(alert.id))}
            />
          ))}
        </ul>
      )}

      {editing?.product && (
        <PriceAlertDialog
          product={editing.product}
          current={editing}
          open
          onClose={() => setEditing(null)}
          onSaved={(next) => {
            setItems(next);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
