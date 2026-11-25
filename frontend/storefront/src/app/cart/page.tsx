'use client';

import { useRouter } from 'next/navigation';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { HomeFooter } from '@/features/home/components/HomeFooter';
import { MarketplaceDialogs } from '@/features/home/components/MarketplaceDialogs';
import { card, secondary } from '@/features/product/components/primitives';
import { useCart } from '@/features/cart/hooks/use-cart';
import { cartApi } from '@/features/cart/api';
import type { CartChanges } from '@/features/cart/types';
import { CartItemGroup } from '@/features/cart/components/CartItemGroup';
import { CouponInput } from '@/features/cart/components/CouponInput';
import { CoinsToggle } from '@/features/cart/components/CoinsToggle';
import { PriceSummary } from '@/features/cart/components/PriceSummary';
import { SavedForLater } from '@/features/cart/components/SavedForLater';
import { CheckoutButton } from '@/features/cart/components/CheckoutButton';

export default function CartPage() {
  const { cart, loading, error, busy, mutate, retry } = useCart();
  const router = useRouter();

  const change = (id: string, data: CartChanges) => {
    void mutate(() => cartApi.change(id, data)).catch(() => undefined);
  };

  const hasGroups = Boolean(cart?.groups && cart.groups.length > 0);
  const hasSaved = Boolean(cart?.savedForLater && cart.savedForLater.length > 0);
  const isEmpty = !loading && !error && !hasGroups;

  return (
    <>
      <HomeHeader />
      <main className="mx-auto max-w-7xl min-h-[60vh] space-y-6 px-4 py-6 pb-40 text-[#12203F] sm:px-6">
        <h1 className="text-3xl font-semibold">Your cart</h1>

        {loading && (
          <div role="status" aria-label="Loading cart" className="space-y-4 motion-safe:animate-pulse">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`${card} h-32 bg-slate-50`} />
            ))}
          </div>
        )}

        {error && (
          <div role="alert" className={`${card} border-rose-200 bg-rose-50/30`}>
            <p className="font-medium text-rose-800">{error || 'We could not load your cart.'}</p>
            <button type="button" className={`${secondary} mt-3`} onClick={retry}>
              Try again
            </button>
          </div>
        )}

        {cart && (
          <div className="grid items-start gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              {isEmpty && (
                <div className={`${card} text-center py-12`}>
                  <h2 className="text-xl font-semibold text-[#12203F]">Your cart is empty</h2>
                  <p className="mt-2 text-sm text-slate-500">Looks like you haven't added anything to your cart yet.</p>
                  <a className={`${secondary} mt-6 inline-flex`} href="/">
                    Continue shopping
                  </a>
                </div>
              )}

              {hasGroups &&
                cart.groups.map((group) => (
                  <CartItemGroup
                    key={group.vendorId}
                    group={group}
                    busy={busy}
                    onChange={change}
                    onRemove={(id) => {
                      void mutate(() => cartApi.remove(id)).catch(() => undefined);
                    }}
                  />
                ))}

              {hasSaved && (
                <SavedForLater
                  items={cart.savedForLater}
                  busy={busy}
                  onMove={(id) => {
                    const item = cart.savedForLater.find((i) => i.id === id);
                    if (item) {
                      change(id, {
                        savedForLater: false,
                        quantity: Math.min(item.quantity, item.maxQuantity || 1),
                      });
                    }
                  }}
                />
              )}
            </div>

            {hasGroups && (
              <aside className={`${card} space-y-5 lg:sticky lg:top-6`} aria-label="Cart totals">
                <CouponInput
                  coupon={cart.coupon}
                  busy={busy}
                  onApply={(code) => mutate(() => cartApi.coupon(code))}
                />
                <CoinsToggle
                  coins={cart.coins}
                  busy={busy}
                  onChange={(coinsEnabled) =>
                    change(cart.groups[0].items[0].id, { coinsEnabled })
                  }
                />
                <PriceSummary summary={cart.summary} />
                <div className="hidden lg:block">
                  <CheckoutButton
                    groups={cart.groups}
                    busy={busy}
                    onCheckout={() => router.push('/checkout')}
                  />
                </div>
              </aside>
            )}
          </div>
        )}

        {/* Mobile sticky bottom bar */}
        {hasGroups && (
          <div className="fixed inset-x-0 bottom-0 z-40 space-y-3 border-t border-slate-200 bg-white p-4 shadow-lg lg:hidden">
            <PriceSummary summary={cart!.summary} compact />
            <CheckoutButton
              groups={cart!.groups}
              busy={busy}
              onCheckout={() => router.push('/checkout')}
            />
          </div>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
