'use client';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, apiFetch } from '@/lib/http';
import { homeApi } from '../home/api';
import { accountApi } from '../account/api';
import { useHome } from '../home/home-provider';
import { HomeHeader } from '../home/components/HomeHeader';
import { CategoryNav } from '../home/components/CategoryNav';
import { HomeFooter } from '../home/components/HomeFooter';
import { MarketplaceDialogs } from '../home/components/MarketplaceDialogs';
import { ProductView } from './ProductView';
import { adaptProduct, toCatalogProduct } from './adapter';
import { parseProductPayload, type ProductPayload } from './data';
import type { Product, ProductActions, Purchase } from './types';
import { button, Modal } from './components/primitives';
import { ProductSkeleton } from './components/ProductSkeleton';

export function ProductDetailsPage({
  slug,
  initial,
}: {
  slug: string;
  initial?: ProductPayload | null;
}) {
  const home = useHome();
  const [data, setData] = useState(initial);
  const [state, setState] = useState(initial ? 'ready' : 'loading');
  const [attempt, setAttempt] = useState(0);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>(initial?.similar ?? []);
  const [checkout, setCheckout] = useState(false);
  const demo = process.env.NODE_ENV === 'development' && slug.startsWith('demo-');
  useEffect(() => {
    if (initial && !attempt) return;
    const controller = new AbortController();
    setState('loading');
    apiFetch<unknown>(`/products/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(parseProductPayload)
      .then((found) => {
        if (!controller.signal.aborted) {
          setData(found);
          setState('ready');
        }
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState(e instanceof ApiError && e.status === 404 ? 'missing' : 'error');
      });
    return () => controller.abort();
  }, [slug, attempt, initial]);
  useEffect(() => {
    if (!data) return;
    const controller = new AbortController();
    const ids = [
      ...new Set([
        ...(data.product.related?.similar ?? []),
        ...(data.product.related?.boughtTogether ?? []),
      ]),
    ].filter((id) => id !== data.product.id);
    setRelatedProducts(data.similar);
    if (demo) {
      void import('./mock/products').then(({ mockProducts }) => {
        if (!controller.signal.aborted)
          setRelatedProducts(mockProducts.filter((p) => ids.includes(p.id)));
      });
    } else {
      void homeApi.recordView(data.product.id).catch(() => undefined);
      if (ids.length)
        void apiFetch<{ items: unknown[] }>(
          `/products/by-ids?ids=${encodeURIComponent(ids.slice(0, 30).join(','))}`,
          { signal: controller.signal },
        )
          .then((res) => {
            const products = res.items.flatMap((p) => {
              try {
                return [adaptProduct(p)];
              } catch {
                return [];
              }
            });
            if (!controller.signal.aborted) setRelatedProducts(products);
          })
          .catch(() => undefined);
    }
    return () => controller.abort();
  }, [data, demo]);
  const product = data?.product;
  const related = useMemo(
    () => ({
      similar: relatedProducts.filter(
        (p) => p.id !== product?.id && product?.related?.similar?.includes(p.id),
      ),
      together: relatedProducts.filter(
        (p) => p.id !== product?.id && product?.related?.boughtTogether?.includes(p.id),
      ),
      recent: demo
        ? []
        : home.recent
            .filter((p) => p.id !== product?.id)
            .flatMap((p) => {
              try {
                return [adaptProduct(p)];
              } catch {
                return [];
              }
            }),
    }),
    [relatedProducts, product, home.recent, demo],
  );
  async function add(purchase: Purchase) {
    if (demo) throw new Error('This is a demo product. Purchases are disabled.');
    if (purchase.product.variants?.length)
      throw new Error(
        'These product options cannot be ordered online yet. Please contact Trustlon support.',
      );
    await home.addToCart(toCatalogProduct(purchase.product), purchase.quantity, true);
  }
  const actions: ProductActions = {
    addToCart: add,
    buyNow: async () => {
      setCheckout(true);
    },
    wishlist: async (p) => {
      if (demo) throw new Error('Demo products cannot be saved to your account.');
      await home.toggleWishlist(toCatalogProduct(p));
    },
    checkDelivery: async (pin) => {
      const result = await homeApi.serviceability(pin);
      if (!result.serviceable) return 'Delivery is not yet supported at this pincode.';
      home.setPincode(pin);
      return `Delivery to ${result.city ?? pin}${result.estimatedDeliveryDays != null ? ` in approximately ${result.estimatedDeliveryDays} days` : ''}.${product?.policies?.cod && result.codAvailable ? ' Cash on delivery eligible.' : ''}`;
    },
    setAlert: async (p, price) => {
      if (demo) throw new Error('Price alerts are disabled for demo products.');
      await accountApi.savePriceAlert(p.id, Math.round(price * 100));
    },
  };
  return (
    <>
      <HomeHeader />
      <CategoryNav />
      {demo && (
        <div className="flex flex-wrap items-center justify-center gap-4 bg-teal-50 px-4 py-3 text-xs text-teal-900">
          <strong>Development preview · Sample data</strong>
          {['headphones', 't-shirt', 'smartphone', 'rice', 'sofa'].map((id) => (
            <a key={id} href={`/p/demo-${id}`} className="underline">
              {id}
            </a>
          ))}
        </div>
      )}
      {state === 'loading' && <ProductSkeleton />}
      {state === 'error' && (
        <main className="p-16 text-center">
          <h1 className="text-2xl font-semibold">Let’s try that again</h1>
          <p className="mt-3 text-slate-500">We couldn’t load this product.</p>
          <button className={`${button} mt-5`} onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </button>
        </main>
      )}
      {state === 'missing' && (
        <main className="p-16 text-center">
          <h1 className="text-2xl font-semibold">This product has moved on</h1>
          <a className={`${button} mt-5`} href="/">
            Continue shopping
          </a>
        </main>
      )}
      {state === 'ready' && product && (
        <ProductView
          key={product.id}
          product={product}
          actions={actions}
          related={related}
          wishlisted={home.isWishlisted(product.id)}
        />
      )}
      <HomeFooter />
      <MarketplaceDialogs />
      {checkout && (
        <Modal title="Buy from Trustlon" onClose={() => setCheckout(false)}>
          <p className="leading-7 text-slate-600">
            Checkout is not connected in this storefront yet. You can add products to your cart and
            review them while checkout is being prepared.
          </p>
          <button
            className={`${button} mt-4`}
            onClick={() => {
              setCheckout(false);
              home.setPanel('cart');
            }}
          >
            View cart
          </button>
        </Modal>
      )}
    </>
  );
}
