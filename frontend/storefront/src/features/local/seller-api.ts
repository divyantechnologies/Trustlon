import { apiFetch } from '@/lib/http';

export interface SellerDelivery {
  id: string;
  displayName: string;
  pickupAddress: string | null;
  pickupPincode: string | null;
  pickupLat: number | null;
  pickupLng: number | null;
  sameDayDelivery: boolean;
  nextDayDelivery: boolean;
  deliveryCutoffTime: string | null;
}

export type SellerDeliveryInput = Pick<
  SellerDelivery,
  'sameDayDelivery' | 'nextDayDelivery' | 'deliveryCutoffTime'
> & {
  pickupAddress: string;
  pickupPincode: string;
};

export const sellerApi = {
  list: (signal: AbortSignal) =>
    apiFetch<{ items: SellerDelivery[] }>('/me/stores/delivery', { auth: true, signal }),
  save: (id: string, body: SellerDeliveryInput) =>
    apiFetch<SellerDelivery>(`/me/stores/${encodeURIComponent(id)}/delivery`, {
      auth: true,
      method: 'PUT',
      body,
    }),
};
