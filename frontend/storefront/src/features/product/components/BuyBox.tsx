'use client';
import { useEffect, useState } from 'react';
import type { Product, ProductActions, Purchase } from '../types';
import { money } from '../helpers';
import { button, card, field, Modal, secondary } from './primitives';
import { PolicyCards } from './PolicyCards';
import { QuantityStepper } from './QuantityStepper';
export function PriceBlock({ product }: { product: Product }) {
  const { current, mrp, taxInclusive } = product.price;
  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="text-3xl font-semibold tracking-tight">{money(current)}</span>
        {mrp !== undefined && mrp > current && (
          <>
            <del className="text-sm text-slate-400">{money(mrp)}</del>
            <span className="rounded-md bg-teal-50 px-2 py-1 text-sm font-semibold text-teal-800">
              {Math.round((1 - current / mrp) * 100)}% off
            </span>
          </>
        )}
      </div>
      {taxInclusive && <p className="mt-1 text-xs text-slate-500">Inclusive of all taxes</p>}
      {product.offers?.some((o) => o.type === 'emi') && (
        <p className="mt-3 text-sm text-slate-600">
          Indicative 12-month EMI from {money(current / 12)}/month. Interest and eligibility depend
          on provider terms.
        </p>
      )}
    </div>
  );
}
export function BuyBox({
  purchase,
  actions,
  canBuy,
  wishlisted,
  quantity,
  onQuantity,
  mobile = false,
  busy,
  onPurchase,
}: {
  purchase: Purchase;
  actions: ProductActions;
  canBuy: boolean;
  wishlisted: boolean;
  quantity: number;
  onQuantity: (n: number) => void;
  mobile?: boolean;
  busy: boolean;
  onPurchase: (buy: boolean) => void;
}) {
  const product = purchase.product;
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [notify, setNotify] = useState(false);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    setMessage('');
    setSaved(false);
  }, [product.id]);
  const max = Math.min(product.stock.quantity ?? Infinity, product.purchaseLimit ?? Infinity);
  const buttons = canBuy ? (
    <>
      <button
        className={mobile ? `${secondary} !px-3` : `${button} w-full`}
        disabled={busy}
        onClick={() => onPurchase(false)}
      >
        {busy ? 'Please wait…' : 'Add to cart'}
      </button>
      <button
        className={`${button} ${mobile ? '!px-3' : 'w-full'}`}
        disabled={busy}
        onClick={() => onPurchase(true)}
      >
        Buy now
      </button>
    </>
  ) : (
    <button className={`${button} ${mobile ? '' : 'w-full'}`} onClick={() => setNotify(true)}>
      Notify me
    </button>
  );
  if (mobile)
    return (
      <div className="fixed inset-x-0 bottom-0 z-40 flex items-center gap-2 border-t border-slate-200 bg-white/95 px-3 py-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-lg backdrop-blur xl:hidden">
        <span className="mr-auto text-sm font-semibold">{money(product.price.current)}</span>
        {canBuy ? (
          buttons
        ) : (
          <a className={button} href="#purchase">
            Notify me
          </a>
        )}
      </div>
    );
  return (
    <aside
      id="purchase"
      className={`${card} scroll-mt-24 xl:sticky xl:top-24`}
      aria-label="Purchase product"
    >
      <PriceBlock product={product} />
      <p className={`mt-4 text-sm font-medium ${canBuy ? 'text-teal-700' : 'text-slate-500'}`}>
        {canBuy
          ? product.stock.quantity !== undefined && product.stock.quantity <= 5
            ? `Only ${product.stock.quantity} left in stock`
            : product.stock.status === 'low'
              ? 'Low stock'
              : 'In stock'
          : 'Out of stock'}
      </p>
      {canBuy && (
        <div className="mt-4 flex items-center justify-between gap-3 text-sm">
          <span>Quantity</span>
          <QuantityStepper value={quantity} min={1} max={max} onChange={onQuantity} />
        </div>
      )}
      <div className="mt-5 space-y-3">
        {buttons}
        <button
          aria-pressed={wishlisted}
          className={`${secondary} w-full`}
          onClick={async () => {
            try {
              await actions.wishlist(product);
            } catch (e) {
              setMessage(e instanceof Error ? e.message : 'Please try again.');
            }
          }}
        >
          {wishlisted ? '♥ Saved to wishlist' : '♡ Save to wishlist'}
        </button>
      </div>
      <form
        className="mt-5 border-t border-slate-100 pt-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!/^[1-9]\d{5}$/.test(pin)) {
            setMessage('Enter a valid six-digit Indian pincode.');
            return;
          }
          setChecking(true);
          setMessage('');
          try {
            setMessage(await actions.checkDelivery(pin));
          } catch (e) {
            setMessage(e instanceof Error ? e.message : 'Please try again.');
          } finally {
            setChecking(false);
          }
        }}
      >
        <label htmlFor="delivery-pin" className="text-sm font-semibold">
          Delivery to your door
        </label>
        <div className="mt-2 flex gap-2">
          <input
            id="delivery-pin"
            className={`${field} min-w-0`}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="Enter pincode"
            maxLength={6}
            pattern="[1-9][0-9]{5}"
            required
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setMessage('');
            }}
          />
          <button className={`${secondary} !px-3`} disabled={checking}>
            Check
          </button>
        </div>
      </form>
      <p role="status" className="mt-2 text-sm text-teal-700">
        {message}
      </p>
      <div className="mt-4 border-t border-slate-100 pt-4 text-sm">
        <p className="text-slate-500">
          Sold by{' '}
          {product.seller.slug ? (
            <a
              className="font-semibold text-[#12203F]"
              href={`/browse/${encodeURIComponent(product.seller.slug)}`}
            >
              {product.seller.name}
            </a>
          ) : (
            <span className="font-semibold text-[#12203F]">{product.seller.name}</span>
          )}
        </p>
        {product.seller.verified && (
          <p className="mt-2 text-xs font-medium text-teal-700">✓ Trustlon Verified seller</p>
        )}
        {product.seller.rating !== undefined && (
          <p className="mt-2 text-xs">Seller rating {product.seller.rating}/5</p>
        )}
        <div className="mt-4">
          <PolicyCards policies={product.policies} compact />
        </div>
      </div>
      {notify && (
        <Modal title="Back-in-stock notifications" onClose={() => setNotify(false)}>
          {actions.notify ? (
            <>
              <p>Get an update when {product.title} returns.</p>
              <button
                disabled={saved}
                className={`${button} mt-4`}
                onClick={async () => {
                  try {
                    await actions.notify!(product);
                    setSaved(true);
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : 'Please try again.');
                  }
                }}
              >
                {saved ? 'Notification saved' : 'Notify me'}
              </button>
              <p role="status">{message}</p>
            </>
          ) : (
            <>
              <p className="leading-7 text-slate-600">
                Stock notifications are not connected yet. Save this product to your wishlist to
                find it again.
              </p>
              <button
                className={`${button} mt-4`}
                onClick={async () => {
                  try {
                    if (!wishlisted) await actions.wishlist(product);
                    setNotify(false);
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : 'Please try again.');
                  }
                }}
              >
                Save to wishlist
              </button>
            </>
          )}
        </Modal>
      )}
    </aside>
  );
}
