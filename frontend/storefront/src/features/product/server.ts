import { cache } from 'react';
import { parseProductPayload } from './data';
export const loadProduct = cache(async (slug: string) => {
  if (process.env.NODE_ENV === 'development' && slug.startsWith('demo-')) {
    const { getMockProduct, mockProducts } = await import('./mock/products');
    const product = getMockProduct(slug);
    if (product)
      return {
        product,
        similar: mockProducts.filter((p) => product.related?.similar?.includes(p.id)),
      };
  }
  const response = await fetch(
    `${process.env.API_URL ?? 'http://localhost:4000'}/api/v1/products/${encodeURIComponent(slug)}`,
    { cache: 'no-store', signal: AbortSignal.timeout(8000) },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Could not load product');
  return parseProductPayload(await response.json());
});
