'use client';
import { createContext, useContext, useState } from 'react';
import { initialRecentIds, findProduct } from './data/products';
type Panel = 'cart' | 'wishlist' | 'pincode' | null;
interface HomeState {
  pincode: string;
  setPincode: (value: string) => void;
  cart: Record<string, number>;
  addToCart: (id: string) => void;
  setQuantity: (id: string, count: number) => void;
  wishlist: string[];
  toggleWishlist: (id: string) => void;
  recent: string[];
  selectedProduct: string | null;
  viewProduct: (id: string) => void;
  closeProduct: () => void;
  panel: Panel;
  setPanel: (panel: Panel) => void;
  notice: string;
  announce: (message: string) => void;
}
const Context = createContext<HomeState | null>(null);
/** Session-only demonstration state. No auth, API calls, inventory, or cart persistence. */
export function HomeProvider({ children }: { children: React.ReactNode }) {
  const [pincode, setPincode] = useState('560001');
  const [cart, setCart] = useState<Record<string, number>>({});
  const [wishlist, setWishlist] = useState<string[]>([]);
  const [recent, setRecent] = useState(initialRecentIds);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>(null);
  const [notice, announce] = useState('');
  const value: HomeState = {
    pincode,
    setPincode,
    cart,
    wishlist,
    recent,
    selectedProduct,
    panel,
    setPanel,
    notice,
    announce,
    addToCart: (id) => {
      if (!findProduct(id)) return;
      setCart((previous) => ({ ...previous, [id]: Math.min((previous[id] ?? 0) + 1, 10) }));
      announce(`${findProduct(id)?.name} added to your demo cart.`);
    },
    setQuantity: (id, count) =>
      setCart((previous) => {
        const next = { ...previous };
        if (count <= 0) delete next[id];
        else next[id] = Math.min(count, 10);
        return next;
      }),
    toggleWishlist: (id) =>
      setWishlist((previous) =>
        previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
      ),
    viewProduct: (id) => {
      setSelectedProduct(id);
      setPanel(null);
      setRecent((previous) => [id, ...previous.filter((item) => item !== id)].slice(0, 6));
    },
    closeProduct: () => setSelectedProduct(null),
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useHome() {
  const context = useContext(Context);
  if (!context) throw new Error('HomeProvider is required');
  return context;
}
