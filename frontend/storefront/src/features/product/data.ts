import { adaptProduct } from './adapter';
import type { Product } from './types';
export type ProductPayload = { product: Product; similar: Product[] };
export function parseProductPayload(raw: unknown): ProductPayload {
  const data = raw as { product?: unknown; similar?: unknown[] };
  const similar = (Array.isArray(data?.similar) ? data.similar : []).flatMap((item) => {
    try {
      return [adaptProduct(item)];
    } catch {
      return [];
    }
  });
  const product = adaptProduct(raw);
  if (!product.related?.similar && similar.length)
    product.related = { ...product.related, similar: similar.map((p) => p.id) };
  return { product, similar };
}
