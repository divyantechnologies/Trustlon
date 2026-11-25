/** All monetary values in these API contracts are integer paise. */
export type StockStatus = 'in_stock' | 'low' | 'out';

export interface CartItemView {
  id: string;
  productId: string;
  slug: string;
  title: string;
  name: string;
  image: string;
  variantLabel: string | null;
  price: number;
  mrp: number;
  quantity: number;
  maxQuantity: number;
  stockStatus: StockStatus;
  available: boolean;
  priceChanged?: boolean;
  priceUpdated?: boolean;
  notice?: string | null;
  message?: string | null;
  unitPricePaise: number;
  mrpPaise: number;
  lineTotalPaise: number;
  discountPercent: number;
}

export interface CartGroupView {
  vendorId: string;
  vendorName: string;
  expectedDelivery: string | null;
  items: CartItemView[];
  seller?: { slug: string; name: string; isPlatformOwned: boolean; isVerified: boolean };
  subtotalPaise?: number;
}

export interface PriceSummaryView {
  itemsTotal: number;
  discount: number;
  couponDiscount: number;
  deliveryFee: number;
  coinsUsed: number;
  totalPayable: number;
}

export interface CartView {
  groups: CartGroupView[];
  savedForLater: CartItemView[];
  coupon: { code: string; valid: boolean; message: string } | null;
  coins: { balance: number; used: number; enabled: boolean };
  summary: PriceSummaryView;
  currency: string;
  itemCount: number;
  subtotalPaise: number;
  savingsPaise: number;
  hasUnavailableItems: boolean;
}

export interface CartChanges {
  quantity?: number;
  savedForLater?: boolean;
  moveToWishlist?: boolean;
  coinsEnabled?: boolean;
}
