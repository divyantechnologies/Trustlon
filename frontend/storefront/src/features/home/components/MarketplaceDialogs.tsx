'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, TextField } from '@/design-system';
import { homeApi } from '../api';
import { formatPrice } from '../format';
import { useHome } from '../home-provider';
import type { Product, Serviceability } from '../types';
import { ProductImage } from './ProductImage';

function DeliveryEstimate({ pincode }: { pincode: string }) {
  const [info, setInfo] = useState<Serviceability | null>(null);
  useEffect(() => {
    let cancelled = false;
    homeApi
      .serviceability(pincode)
      .then((data) => !cancelled && setInfo(data))
      .catch(() => !cancelled && setInfo(null));
    return () => {
      cancelled = true;
    };
  }, [pincode]);
  if (!info) return null;
  if (!info.serviceable) {
    return <Alert tone="error">We don’t deliver to {pincode} yet.</Alert>;
  }
  return (
    <p className="text-sm text-slate-500">
      Delivery to {info.city ?? pincode} ({pincode}) in about {info.estimatedDeliveryDays} days
      {info.codAvailable ? ' · Cash on delivery available' : ''}
    </p>
  );
}

function SavedItem({ product }: { product: Product }) {
  const home = useHome();
  return (
    <div className="flex items-start gap-4 border-b border-slate-100 pb-5">
      <ProductImage src={product.image} alt={product.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
      <div className="min-w-0 flex-1">
        <button className="text-left font-medium hover:underline" onClick={() => home.viewProduct(product)}>
          {product.name}
        </button>
        <p className="my-2 font-semibold">{formatPrice(product.pricePaise)}</p>
        <div className="flex flex-wrap gap-4">
          <Button variant="link" disabled={!product.inStock} onClick={() => void home.addToCart(product)}>
            {product.inStock ? 'Add to cart' : 'Out of stock'}
          </Button>
          <Button variant="link" onClick={() => void home.toggleWishlist(product)}>
            Remove
          </Button>
        </div>
      </div>
    </div>
  );
}

export function MarketplaceDialogs() {
  const home = useHome();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    if (home.panel === 'pincode') {
      setPin(home.pincode);
      setError('');
    }
  }, [home.panel, home.pincode]);
  const product = home.selectedProduct;
  const cart = home.cart;
  const lines = cart?.groups.flatMap((group) => group.items.map((item) => ({ item, seller: group.seller }))) ?? [];
  return (
    <>
      <Dialog open={home.panel === 'pincode'} title="Where should we deliver?" onClose={() => home.setPanel(null)}>
        <p className="mb-5 text-slate-500">
          Enter your pincode to see delivery times and sellers near you.
        </p>
        <form
          className="space-y-5"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!/^[1-9][0-9]{5}$/.test(pin)) {
              setError('Enter a valid six-digit Indian pincode.');
              return;
            }
            setChecking(true);
            try {
              const info = await homeApi.serviceability(pin);
              home.setPincode(pin);
              home.setPanel(null);
              home.announce(
                info.serviceable
                  ? `Delivering to ${info.city ?? pin} (${pin}).`
                  : `We don’t deliver to ${pin} yet. You can still browse.`,
              );
            } catch {
              setError('We couldn’t check this pincode. Please try again.');
            } finally {
              setChecking(false);
            }
          }}
        >
          <TextField
            label="Delivery pincode"
            value={pin}
            placeholder={home.pincode}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''));
              setError('');
            }}
            inputMode="numeric"
            maxLength={6}
            error={error}
            autoComplete="postal-code"
          />
          <Button type="submit" loading={checking}>
            Use this pincode
          </Button>
        </form>
      </Dialog>

      <Dialog open={home.panel === 'cart'} title="Your shopping bag" onClose={() => home.setPanel(null)}>
        <div className="space-y-5">
          {lines.length === 0 && (
            <p className="py-8 text-center text-slate-500">Nothing here yet. Discover something you love.</p>
          )}
          {lines.map(({ item, seller }) => (
            <div key={item.productId} className="flex items-start gap-4 border-b border-slate-100 pb-5">
              <ProductImage src={item.image} alt={item.name} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-medium">{item.name}</p>
                <p className="mt-1 text-xs text-slate-500">Sold by {seller.name}</p>
                <p className="my-2 font-semibold">
                  {formatPrice(item.unitPricePaise)}
                  {item.mrpPaise > item.unitPricePaise && (
                    <del className="ml-2 text-xs font-normal text-slate-500">{formatPrice(item.mrpPaise)}</del>
                  )}
                </p>
                {!item.available ? (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">This item is no longer available.</p>
                    <Button variant="link" onClick={() => void home.setQuantity(item.productId, 0)}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="h-11 w-11 rounded-lg border border-slate-300"
                      aria-label={`Decrease quantity of ${item.name}`}
                      onClick={() => void home.setQuantity(item.productId, item.quantity - 1)}
                    >
                      −
                    </button>
                    <span aria-label="Quantity">{item.quantity}</span>
                    <button
                      className="h-11 w-11 rounded-lg border border-slate-300 disabled:opacity-40"
                      disabled={item.quantity >= item.maxQuantity}
                      aria-label={`Increase quantity of ${item.name}`}
                      onClick={() => void home.setQuantity(item.productId, item.quantity + 1)}
                    >
                      +
                    </button>
                    <Button variant="link" onClick={() => void home.setQuantity(item.productId, 0)}>
                      Remove
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ))}
          {cart && cart.itemCount > 0 && (
            <>
              <div className="flex justify-between text-lg font-semibold">
                <span>Subtotal ({cart.itemCount} items)</span>
                <span>{formatPrice(cart.subtotalPaise)}</span>
              </div>
              {cart.savingsPaise > 0 && (
                <p className="text-sm text-teal-600">You save {formatPrice(cart.savingsPaise)} on this order.</p>
              )}
              <Alert tone="info">Checkout opens soon. Your bag is saved to your account when you sign in.</Alert>
            </>
          )}
        </div>
      </Dialog>

      <Dialog open={home.panel === 'wishlist'} title="Your saved favourites" onClose={() => home.setPanel(null)}>
        <div className="space-y-5">
          {home.wishlist.length === 0 && (
            <p className="py-8 text-center text-slate-500">Nothing here yet. Tap the heart on anything you love.</p>
          )}
          {home.wishlist.map((item) => (
            <SavedItem key={item.id} product={item} />
          ))}
        </div>
      </Dialog>

      <Dialog open={Boolean(product)} title={product?.name ?? 'Product'} onClose={home.closeProduct}>
        {product && (
          <div className="space-y-5">
            <ProductImage src={product.image} alt={product.name} className="h-64 w-full rounded-lg object-cover" />
            <p className="text-slate-500">
              By {product.seller.name}
              {product.seller.isVerified ? ' · Trustlon Verified' : ''}
              {product.ratingCount > 0 ? ` · ${product.rating.toFixed(1)}★ (${product.ratingCount})` : ''}
            </p>
            <p className="text-2xl font-semibold">
              {formatPrice(product.pricePaise)}{' '}
              {product.mrpPaise > product.pricePaise && (
                <>
                  <del className="text-sm font-normal text-slate-500">{formatPrice(product.mrpPaise)}</del>
                  <span className="ml-2 text-sm font-medium text-teal-600">{product.discountPercent}% off</span>
                </>
              )}
            </p>
            <DeliveryEstimate pincode={home.pincode} />
            <Button
              variant="secondary"
              disabled={!product.inStock}
              onClick={() => void home.addToCart(product)}
            >
              {product.inStock ? 'Add to cart' : 'Out of stock'}
            </Button>
            <Button variant="link" onClick={() => void home.toggleWishlist(product)}>
              {home.isWishlisted(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
            </Button>
          </div>
        )}
      </Dialog>

      <div aria-live="polite" className="sr-only">
        {home.notice}
      </div>
      {home.notice && (
        <div className="fixed bottom-5 left-4 right-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-lg border border-teal/30 bg-white p-4 shadow-sm">
          <p className="flex-1 text-sm">{home.notice}</p>
          <button
            className="h-11 w-11 shrink-0 rounded-lg text-xl"
            aria-label="Dismiss notification"
            onClick={() => home.announce('')}
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
