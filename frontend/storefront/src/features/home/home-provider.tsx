'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/features/auth';
import { ApiError } from '@/lib/http';
import { homeApi } from './api';
import { readLocal, writeLocal } from './guest';
import type { Cart, HomeData, Product } from './types';

type Panel = 'cart' | 'wishlist' | 'pincode' | null;
type LoadState = 'loading' | 'ready' | 'error';

const PINCODE_KEY = 'tl_pincode';
const GUEST_WISHLIST_KEY = 'tl_wishlist';
const DEFAULT_PINCODE = '560001';

interface HomeState {
  home: HomeData | null;
  homeState: LoadState;
  reloadHome: () => void;

  pincode: string;
  setPincode: (value: string) => void;

  cart: Cart | null;
  cartCount: number;
  quantityInCart: (productId: string) => number;
  addToCart: (product: Product, quantity?: number) => Promise<void>;
  setQuantity: (productId: string, quantity: number) => Promise<void>;

  wishlist: Product[];
  isWishlisted: (productId: string) => boolean;
  toggleWishlist: (product: Product) => Promise<void>;

  recent: Product[];
  selectedProduct: Product | null;
  viewProduct: (product: Product) => void;
  closeProduct: () => void;

  panel: Panel;
  setPanel: (panel: Panel) => void;
  notice: string;
  announce: (message: string) => void;
}

const Context = createContext<HomeState | null>(null);

const errorMessage = (error: unknown) =>
  error instanceof ApiError && error.message ? error.message : 'Something went wrong. Please try again.';

/** Storefront shopping state, backed by the Trustlon API. Wrap the app with it (inside AuthProvider). */
export function HomeProvider({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';

  const [home, setHome] = useState<HomeData | null>(null);
  const [homeState, setHomeState] = useState<LoadState>('loading');
  const [homeAttempt, setHomeAttempt] = useState(0);

  const [pincode, setPincodeState] = useState(DEFAULT_PINCODE);
  const [cart, setCart] = useState<Cart | null>(null);
  const [wishlist, setWishlist] = useState<Product[]>([]);
  const [recent, setRecent] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, announce] = useState('');
  const syncedGuestWishlist = useRef(false);

  useEffect(() => {
    setPincodeState(readLocal(PINCODE_KEY, DEFAULT_PINCODE));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setHomeState('loading');
    homeApi
      .home(controller.signal)
      .then((data) => {
        setHome(data);
        setHomeState('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setHomeState('error');
      });
    return () => controller.abort();
  }, [homeAttempt]);

  // Cart, wishlist and history depend on who is shopping; reload them when sign-in state settles.
  useEffect(() => {
    if (status === 'loading') return;
    let cancelled = false;

    homeApi
      .cart()
      .then((data) => !cancelled && setCart(data))
      .catch(() => !cancelled && setCart(null));
    homeApi
      .recentlyViewed()
      .then((data) => !cancelled && setRecent(data.items))
      .catch(() => !cancelled && setRecent([]));

    if (signedIn) {
      (async () => {
        // Move items saved before sign-in to the account, once.
        const local = readLocal<Product[]>(GUEST_WISHLIST_KEY, []);
        if (local.length && !syncedGuestWishlist.current) {
          syncedGuestWishlist.current = true;
          await Promise.allSettled(local.map((item) => homeApi.addToWishlist(item.id)));
          writeLocal(GUEST_WISHLIST_KEY, []);
        }
        const data = await homeApi.wishlist();
        if (!cancelled) setWishlist(data.items);
      })().catch(() => !cancelled && setWishlist([]));
    } else {
      setWishlist(readLocal<Product[]>(GUEST_WISHLIST_KEY, []));
    }

    return () => {
      cancelled = true;
    };
  }, [status, signedIn]);

  const setPincode = useCallback((value: string) => {
    setPincodeState(value);
    writeLocal(PINCODE_KEY, value);
  }, []);

  const quantityInCart = useCallback(
    (productId: string) =>
      cart?.groups
        .flatMap((group) => group.items)
        .find((item) => item.productId === productId)?.quantity ?? 0,
    [cart],
  );

  const addToCart = useCallback(async (product: Product, quantity = 1) => {
    try {
      setCart(await homeApi.addToCart(product.id, quantity));
      announce(`${product.name} added to your cart.`);
    } catch (error) {
      announce(errorMessage(error));
    }
  }, []);

  const setQuantity = useCallback(async (productId: string, quantity: number) => {
    try {
      setCart(
        quantity <= 0
          ? await homeApi.removeFromCart(productId)
          : await homeApi.setCartQuantity(productId, quantity),
      );
    } catch (error) {
      announce(errorMessage(error));
    }
  }, []);

  const isWishlisted = useCallback(
    (productId: string) => wishlist.some((item) => item.id === productId),
    [wishlist],
  );

  const toggleWishlist = useCallback(
    async (product: Product) => {
      const saved = wishlist.some((item) => item.id === product.id);
      const next = saved
        ? wishlist.filter((item) => item.id !== product.id)
        : [product, ...wishlist];
      setWishlist(next);

      if (!signedIn) {
        writeLocal(GUEST_WISHLIST_KEY, next);
        return;
      }
      try {
        if (saved) await homeApi.removeFromWishlist(product.id);
        else await homeApi.addToWishlist(product.id);
      } catch (error) {
        setWishlist(wishlist);
        announce(errorMessage(error));
      }
    },
    [wishlist, signedIn],
  );

  const viewProduct = useCallback((product: Product) => {
    setSelectedProduct(product);
    setPanel(null);
    setRecent((previous) => [product, ...previous.filter((item) => item.id !== product.id)].slice(0, 10));
    homeApi.recordView(product.id).catch(() => undefined);
  }, []);

  const value = useMemo<HomeState>(
    () => ({
      home,
      homeState,
      reloadHome: () => setHomeAttempt((n) => n + 1),
      pincode,
      setPincode,
      cart,
      cartCount: cart?.itemCount ?? 0,
      quantityInCart,
      addToCart,
      setQuantity,
      wishlist,
      isWishlisted,
      toggleWishlist,
      recent,
      selectedProduct,
      viewProduct,
      closeProduct: () => setSelectedProduct(null),
      panel,
      setPanel,
      notice,
      announce,
    }),
    [
      home,
      homeState,
      pincode,
      setPincode,
      cart,
      quantityInCart,
      addToCart,
      setQuantity,
      wishlist,
      isWishlisted,
      toggleWishlist,
      recent,
      selectedProduct,
      viewProduct,
      panel,
      notice,
    ],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useHome() {
  const context = useContext(Context);
  if (!context) throw new Error('HomeProvider is required');
  return context;
}
