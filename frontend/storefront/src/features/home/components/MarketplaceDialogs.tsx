'use client';
import { useEffect, useState } from 'react';
import { Alert, Button, Dialog, TextField } from '@/design-system';
import { useHome } from '../home-provider';
import { findProduct, formatPrice } from '../data/products';
import { ProductImage } from './ProductImage';
export function MarketplaceDialogs() {
  const home = useHome();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (home.panel === 'pincode') {
      setPin(home.pincode);
      setError('');
    }
  }, [home.panel, home.pincode]);
  const product = home.selectedProduct ? findProduct(home.selectedProduct) : null;
  const total = Object.entries(home.cart).reduce(
    (sum, [id, count]) => sum + (findProduct(id)?.price ?? 0) * count,
    0,
  );
  return (
    <>
      <Dialog
        open={home.panel === 'pincode'}
        title="Where should we deliver?"
        onClose={() => home.setPanel(null)}
      >
        <p className="mb-5 text-slate-500">
          Find neighbourhood favourites with a demo delivery location.
        </p>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!/^[1-9][0-9]{5}$/.test(pin)) {
              setError('Enter a valid six-digit Indian pincode.');
              return;
            }
            home.setPincode(pin);
            home.setPanel(null);
            setError('');
            home.announce(`Demo location updated to ${pin}.`);
          }}
        >
          <TextField
            label="Delivery pincode"
            value={pin}
            placeholder={home.pincode}
            onChange={(e) => {
              setPin(e.target.value);
              setError('');
            }}
            inputMode="numeric"
            maxLength={6}
            error={error}
            autoComplete="postal-code"
          />
          <Alert tone="info">Preview only. Delivery availability is not checked.</Alert>
          <Button type="submit">Use this pincode</Button>
        </form>
      </Dialog>
      <Dialog
        open={home.panel === 'cart' || home.panel === 'wishlist'}
        title={home.panel === 'cart' ? 'Your shopping bag' : 'Your saved favourites'}
        onClose={() => home.setPanel(null)}
      >
        <div className="space-y-5">
          {(home.panel === 'cart' ? Object.keys(home.cart) : home.wishlist).length === 0 && (
            <p className="py-8 text-center text-slate-500">
              Nothing here yet. Discover something you love.
            </p>
          )}
          {(home.panel === 'cart' ? Object.keys(home.cart) : home.wishlist).map((id) => {
            const item = findProduct(id);
            if (!item) return null;
            return (
              <div key={id} className="flex items-start gap-4 border-b border-slate-100 pb-5">
                <ProductImage
                  src={item.image}
                  alt={item.name}
                  className="h-20 w-20 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <button
                    className="text-left font-medium hover:underline"
                    onClick={() => home.viewProduct(id)}
                  >
                    {item.name}
                  </button>
                  <p className="my-2 font-semibold">{formatPrice(item.price)}</p>
                  {home.panel === 'cart' ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        className="h-11 w-11 rounded-lg border border-slate-300"
                        aria-label={`Decrease quantity of ${item.name}`}
                        onClick={() => home.setQuantity(id, home.cart[id] - 1)}
                      >
                        −
                      </button>
                      <span aria-label="Quantity">{home.cart[id]}</span>
                      <button
                        className="h-11 w-11 rounded-lg border border-slate-300 disabled:opacity-40"
                        disabled={home.cart[id] >= 10}
                        aria-label={`Increase quantity of ${item.name}`}
                        onClick={() => home.setQuantity(id, home.cart[id] + 1)}
                      >
                        +
                      </button>
                      <Button variant="link" onClick={() => home.setQuantity(id, 0)}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      <Button variant="link" onClick={() => home.addToCart(id)}>
                        Add to cart
                      </Button>
                      <Button variant="link" onClick={() => home.toggleWishlist(id)}>
                        Remove
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {home.panel === 'cart' && total > 0 && (
            <>
              <div className="flex justify-between text-lg font-semibold">
                <span>Subtotal</span>
                <span>{formatPrice(total)}</span>
              </div>
              <Alert tone="info">
                This is a frontend demo. Checkout and payments are not connected.
              </Alert>
            </>
          )}
        </div>
      </Dialog>
      <Dialog
        open={Boolean(product)}
        title={product?.name ?? 'Product preview'}
        onClose={home.closeProduct}
      >
        {product && (
          <div className="space-y-5">
            <ProductImage
              src={product.image}
              alt={product.name}
              className="h-64 w-full rounded-lg object-cover"
            />
            <p className="text-slate-500">By {product.seller} · Illustrative product preview</p>
            <p className="text-2xl font-semibold">
              {formatPrice(product.price)}{' '}
              <del className="text-sm font-normal text-slate-500">
                {formatPrice(product.originalPrice)}
              </del>
            </p>
            <Alert tone="info">
              Sample product details. Stock and delivery dates are not checked.
            </Alert>
            <Button variant="secondary" onClick={() => home.addToCart(product.id)}>
              Add to demo cart
            </Button>
            <Button variant="link" onClick={() => home.toggleWishlist(product.id)}>
              {home.wishlist.includes(product.id) ? 'Remove from wishlist' : 'Save to wishlist'}
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
