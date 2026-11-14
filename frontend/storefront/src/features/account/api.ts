import { apiBlob, apiDownload, apiFetch, apiUpload } from '@/lib/http';
import type {
  AccountSummary,
  Address,
  AddressInput,
  CreateReturnInput,
  PriceAlert,
  ReturnDetail,
  ReturnEligibility,
  ReturnSummary,
  CancelReason,
  OrderDetail,
  OrderQuery,
  OrderSummary,
  Page,
} from './types';

function toQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const accountApi = {
  summary: (signal?: AbortSignal) =>
    apiFetch<AccountSummary>('/me/summary', { auth: true, signal }),

  orders: (query: OrderQuery, signal?: AbortSignal) =>
    apiFetch<Page<OrderSummary>>(`/orders${toQuery(query)}`, { auth: true, signal }),

  order: (id: string, signal?: AbortSignal) =>
    apiFetch<OrderDetail>(`/orders/${encodeURIComponent(id)}`, { auth: true, signal }),

  cancelSubOrder: (subOrderId: string, reason: CancelReason, comment?: string) =>
    apiFetch<OrderDetail>(`/sub-orders/${encodeURIComponent(subOrderId)}/cancel`, {
      auth: true,
      method: 'POST',
      body: { reason, comment: comment?.trim() || undefined },
    }),

  downloadInvoice: (subOrderId: string, invoiceNumber: string) =>
    apiDownload(
      `/invoices/${encodeURIComponent(subOrderId)}/pdf`,
      `Trustlon-Invoice-${invoiceNumber.replace(/[^A-Za-z0-9-]+/g, '-')}.pdf`,
    ),

  addresses: () => apiFetch<{ items: Address[] }>('/me/addresses', { auth: true }),

  createAddress: (input: AddressInput) =>
    apiFetch<{ items: Address[] }>('/me/addresses', { auth: true, method: 'POST', body: input }),

  updateAddress: (id: string, input: AddressInput) =>
    apiFetch<{ items: Address[] }>(`/me/addresses/${encodeURIComponent(id)}`, {
      auth: true,
      method: 'PUT',
      body: input,
    }),

  setDefaultAddress: (id: string) =>
    apiFetch<{ items: Address[] }>(`/me/addresses/${encodeURIComponent(id)}/default`, {
      auth: true,
      method: 'POST',
    }),

  removeAddress: (id: string) =>
    apiFetch<{ items: Address[] }>(`/me/addresses/${encodeURIComponent(id)}`, {
      auth: true,
      method: 'DELETE',
    }),

  priceAlerts: () => apiFetch<{ items: PriceAlert[] }>('/me/price-alerts', { auth: true }),

  savePriceAlert: (productId: string, targetPricePaise: number) =>
    apiFetch<{ items: PriceAlert[] }>('/me/price-alerts', {
      auth: true,
      method: 'POST',
      body: { productId, targetPricePaise },
    }),

  updatePriceAlert: (
    id: string,
    changes: { targetPricePaise?: number; status?: 'ACTIVE' | 'PAUSED' },
  ) =>
    apiFetch<{ items: PriceAlert[] }>(`/me/price-alerts/${encodeURIComponent(id)}`, {
      auth: true,
      method: 'PATCH',
      body: changes,
    }),

  removePriceAlert: (id: string) =>
    apiFetch<{ items: PriceAlert[] }>(`/me/price-alerts/${encodeURIComponent(id)}`, {
      auth: true,
      method: 'DELETE',
    }),

  returns: (page: number, pageSize: number, signal?: AbortSignal) =>
    apiFetch<Page<ReturnSummary>>(`/returns${toQuery({ page, pageSize })}`, { auth: true, signal }),

  returnDetail: (id: string, signal?: AbortSignal) =>
    apiFetch<ReturnDetail>(`/returns/${encodeURIComponent(id)}`, { auth: true, signal }),

  returnEligibility: (subOrderId: string, signal?: AbortSignal) =>
    apiFetch<ReturnEligibility>(`/returns/eligibility/${encodeURIComponent(subOrderId)}`, {
      auth: true,
      signal,
    }),

  uploadReturnPhoto: (file: File) => {
    const form = new FormData();
    form.append('photo', file);
    return apiUpload<{ id: string }>('/returns/photos', form);
  },

  returnPhoto: (photoId: string, signal?: AbortSignal) =>
    apiBlob(`/returns/photos/${encodeURIComponent(photoId)}`, signal),

  createReturn: (input: CreateReturnInput) =>
    apiFetch<ReturnDetail>('/returns', { auth: true, method: 'POST', body: input }),

  cancelReturn: (id: string) =>
    apiFetch<ReturnDetail>(`/returns/${encodeURIComponent(id)}/cancel`, {
      auth: true,
      method: 'POST',
    }),
};
