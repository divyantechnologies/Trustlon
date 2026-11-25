import type { Product, Selection } from './types';
export const money = (n: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(n);
export const number = (n: number) => new Intl.NumberFormat('en-IN').format(n);
export function initialSelection(p: Product): Selection {
  if (p.skus?.length)
    return {
      ...(p.skus.find((s) => s.stock.status !== 'out' && s.stock.quantity !== 0) ?? p.skus[0])
        .selections,
    };
  return Object.fromEntries(
    (p.variants ?? []).map((v) => [
      v.type,
      v.options.find((o) => o.available && o.stock?.status !== 'out' && o.stock?.quantity !== 0)
        ?.value ?? '',
    ]),
  );
}
export function resolveSelection(p: Product, selections: Selection) {
  const options = (p.variants ?? []).map((v) =>
    v.options.find((o) => o.value === selections[v.type]),
  );
  const sku = p.skus?.find((s) =>
    (p.variants ?? []).every((v) => s.selections[v.type] === selections[v.type]),
  );
  const quantities = [p.stock.quantity, ...options.map((o) => o?.stock?.quantity)].filter(
    (v): v is number => v !== undefined,
  );
  const unavailable =
    options.some((o) => !o?.available || o.stock?.status === 'out' || o.stock?.quantity === 0) ||
    (Boolean(p.skus?.length) && !sku);
  const stock = sku?.stock ?? {
    status: unavailable
      ? ('out' as const)
      : p.stock.status === 'out'
        ? p.stock.status
        : options.some((o) => o?.stock?.status === 'low')
          ? ('low' as const)
          : p.stock.status,
    quantity: quantities.length ? Math.min(...quantities) : undefined,
  };
  const current =
    sku?.price ??
    Math.max(0, p.price.current + options.reduce((n, o) => n + (o?.priceDelta ?? 0), 0));
  const selectedImage = sku?.image ?? options.find((o) => o?.image)?.image;
  const product = { ...p, price: { ...p.price, current }, stock };
  return {
    product,
    skuId: sku?.id,
    selectedImage,
    canBuy: !unavailable && stock.status !== 'out' && stock.quantity !== 0 && p.purchaseLimit !== 0,
  };
}
export function historyWindow(p: Product, now = Date.now()) {
  return (p.priceHistory ?? [])
    .filter((v) => {
      const date = Date.parse(v.date);
      return date <= now && date >= now - 90 * 86400000;
    })
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
export function productJsonLd(p: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.title,
    sku: p.id,
    image: p.images.map((v) => v.url),
    description: p.description?.overview,
    brand: p.brand ? { '@type': 'Brand', name: p.brand } : undefined,
    offers: {
      '@type': 'Offer',
      price: p.price.current,
      priceCurrency: p.price.currency,
      availability: `https://schema.org/${p.stock.status === 'out' || p.stock.quantity === 0 ? 'OutOfStock' : p.stock.status === 'low' ? 'LimitedAvailability' : 'InStock'}`,
      seller: { '@type': 'Organization', name: p.seller.name },
    },
    aggregateRating: p.rating?.count
      ? { '@type': 'AggregateRating', ratingValue: p.rating.average, ratingCount: p.rating.count }
      : undefined,
  };
}
