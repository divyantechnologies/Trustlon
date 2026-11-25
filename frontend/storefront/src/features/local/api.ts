import { apiFetch } from '@/lib/http';
import type { LocalSeller, Page, Product } from '@/features/home/types';
import type { Radius } from './query';

export interface LocalResult<T> extends Page<T> {
  pincode: string;
  radiusKm: number;
  serviceable: boolean;
}

export const localApi = {
  sellers: (pincode: string, radius: Radius, page: number, signal: AbortSignal) =>
    apiFetch<LocalResult<LocalSeller>>(
      `/local/sellers?${new URLSearchParams({
        pincode,
        radius: String(radius),
        page: String(page),
        pageSize: '6',
      })}`,
      { signal },
    ),
  products: (pincode: string, radius: Radius, page: number, signal: AbortSignal) =>
    apiFetch<LocalResult<Product>>(
      `/local/products?${new URLSearchParams({
        pincode,
        radius: String(radius),
        page: String(page),
        pageSize: '8',
      })}`,
      { signal },
    ),
};
