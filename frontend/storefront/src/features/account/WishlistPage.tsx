'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Alert } from '@/design-system';
import { Icon } from '@/features/home/components/Icon';
import { ProductCard } from '@/features/home/components/ProductCard';
import { useHome } from '@/features/home/home-provider';
import type { Product } from '@/features/home/types';
import { accountApi } from './api';
import { PriceAlertDialog } from './components/PriceAlertDialog';
import { EmptyState, PageHeader, primaryLink, secondaryAction } from './components/ui';
import { formatMoney } from './format';
import type { PriceAlert } from './types';

/** /account/wishlist (spec 3.4). Uses the same wishlist as the heart icons across the store. */
export function WishlistPage() {
  const home = useHome();
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [alerting, setAlerting] = useState<Product | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    accountApi
      .priceAlerts()
      .then((result) => setAlerts(result.items))
      .catch(() => setAlerts([]));
  }, []);

  const alertFor = (productId: string) =>
    alerts.find((alert) => alert.product?.id === productId) ?? null;
  const items = home.wishlist;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wishlist"
        description="Products you saved. Add them to your cart or get told when the price drops."
        action={
          <Link href="/account/price-alerts" className={secondaryAction}>
            <Icon name="star" className="h-4 w-4" />
            Price alerts{alerts.length ? ` (${alerts.length})` : ''}
          </Link>
        }
      />
      <div aria-live="polite">{notice && <Alert tone="success">{notice}</Alert>}</div>

      {items.length === 0 ? (
        <EmptyState
          title="Your wishlist is empty"
          description="Tap the heart on any product to save it here."
          action={
            <Link href="/" className={primaryLink}>
              Discover products
            </Link>
          }
        />
      ) : (
        <>
          <p className="text-sm text-slate-500">
            {items.length} {items.length === 1 ? 'product' : 'products'}
          </p>
          <ul className="grid grid-cols-1 gap-5 min-[400px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
            {items.map((product) => {
              const alert = alertFor(product.id);
              return (
                <li key={product.id} className="flex flex-col gap-2">
                  <div className="flex-1">
                    <ProductCard product={product} />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotice(null);
                      setAlerting(product);
                    }}
                    className={`${secondaryAction} w-full`}
                  >
                    <Icon name="star" className="h-4 w-4 text-teal-600" />
                    {alert ? `Alert at ${formatMoney(alert.targetPricePaise)}` : 'Set price alert'}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {alerting && (
        <PriceAlertDialog
          product={alerting}
          current={alertFor(alerting.id)}
          open={Boolean(alerting)}
          onClose={() => setAlerting(null)}
          onSaved={(next) => {
            setAlerts(next);
            setNotice(`We’ll watch the price of ${alerting.name} for you.`);
            setAlerting(null);
          }}
        />
      )}
    </div>
  );
}
