import { apiDownload, apiFetch } from '@/lib/http';
import type {
  AccountSummary,
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
};
