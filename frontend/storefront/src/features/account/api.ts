import { apiBlob, apiDownload, apiFetch, apiUpload } from '@/lib/http';
import type {
  ActiveSession,
  NotificationChoices,
  ProfileInput,
  SettingsOverview,
  SettingsProfile,
  AccountSummary,
  AffiliateEarning,
  AffiliateLink,
  AffiliateSummary,
  BusinessProfile,
  BusinessProfileInput,
  GstinCheck,
  MyReview,
  PendingReview,
  ReviewInput,
  TicketCategory,
  TicketDetail,
  TicketSummary,
  WalletFilter,
  WalletOverview,
  WalletTransaction,
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

  wallet: () => apiFetch<WalletOverview>('/wallet', { auth: true }),

  walletTransactions: (page: number, type?: WalletFilter, signal?: AbortSignal) =>
    apiFetch<Page<WalletTransaction>>(
      `/wallet/transactions${toQuery({ page, pageSize: 20, type })}`,
      {
        auth: true,
        signal,
      },
    ),

  myReviews: () =>
    apiFetch<{ pending: PendingReview[]; reviews: MyReview[] }>('/me/reviews', { auth: true }),

  createReview: (orderItemId: string, input: ReviewInput) =>
    apiFetch<MyReview>('/reviews', { auth: true, method: 'POST', body: { orderItemId, ...input } }),

  updateReview: (id: string, input: ReviewInput) =>
    apiFetch<MyReview>(`/reviews/${encodeURIComponent(id)}`, {
      auth: true,
      method: 'PATCH',
      body: input,
    }),

  uploadReviewMedia: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ id: string; kind: 'PHOTO' | 'VIDEO' }>('/reviews/media', form);
  },

  reviewMedia: (id: string, signal?: AbortSignal) =>
    apiBlob(`/reviews/media/${encodeURIComponent(id)}`, signal),

  business: () =>
    apiFetch<{
      profile: BusinessProfile | null;
      tiers: Array<{ minQuantity: number; label: string }>;
    }>('/me/b2b', {
      auth: true,
    }),

  saveBusiness: (input: BusinessProfileInput) =>
    apiFetch<BusinessProfile>('/me/b2b', { auth: true, method: 'POST', body: input }),

  checkGstin: (gstin: string) =>
    apiFetch<GstinCheck>('/kyc/gstin/verify', { auth: true, method: 'POST', body: { gstin } }),

  affiliateSummary: () => apiFetch<AffiliateSummary>('/affiliate/summary', { auth: true }),

  affiliateLinks: () => apiFetch<{ items: AffiliateLink[] }>('/affiliate/links', { auth: true }),

  createAffiliateLink: (productId: string) =>
    apiFetch<{ items: AffiliateLink[] }>('/affiliate/links', {
      auth: true,
      method: 'POST',
      body: { productId },
    }),

  affiliateEarnings: (page: number, signal?: AbortSignal) =>
    apiFetch<Page<AffiliateEarning>>(`/affiliate/earnings${toQuery({ page, pageSize: 10 })}`, {
      auth: true,
      signal,
    }),

  trackAffiliateClick: (code: string) =>
    apiFetch<{ code: string; product: { slug: string; name: string; categorySlug: string } }>(
      `/affiliate/clicks/${encodeURIComponent(code)}`,
      { method: 'POST' },
    ),

  tickets: (page: number, status?: 'open' | 'resolved', signal?: AbortSignal) =>
    apiFetch<Page<TicketSummary>>(`/tickets${toQuery({ page, pageSize: 10, status })}`, {
      auth: true,
      signal,
    }),

  ticket: (id: string, signal?: AbortSignal) =>
    apiFetch<TicketDetail>(`/tickets/${encodeURIComponent(id)}`, { auth: true, signal }),

  ticketCategories: () =>
    apiFetch<{ items: Array<{ value: TicketCategory; label: string }> }>('/tickets/categories', {
      auth: true,
    }),

  createTicket: (input: {
    category: TicketCategory;
    subject: string;
    orderId?: string;
    description: string;
    attachmentIds: string[];
  }) => apiFetch<TicketDetail>('/tickets', { auth: true, method: 'POST', body: input }),

  replyTicket: (id: string, body: string, attachmentIds: string[]) =>
    apiFetch<TicketDetail>(`/tickets/${encodeURIComponent(id)}/messages`, {
      auth: true,
      method: 'POST',
      body: { body, attachmentIds },
    }),

  resolveTicket: (id: string) =>
    apiFetch<TicketDetail>(`/tickets/${encodeURIComponent(id)}/resolve`, {
      auth: true,
      method: 'POST',
    }),

  uploadTicketFile: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return apiUpload<{ id: string; fileName: string }>('/tickets/attachments', form);
  },

  ticketFile: (id: string) => apiBlob(`/tickets/attachments/${encodeURIComponent(id)}`),

  settings: () => apiFetch<SettingsOverview>('/me/settings', { auth: true }),

  updateProfile: (input: ProfileInput) =>
    apiFetch<{ profile: SettingsProfile }>('/me', { method: 'PATCH', auth: true, body: input }),

  sendContactCode: (type: 'email' | 'mobile', value: string, currentPassword?: string) =>
    apiFetch<{ target: string; expiresInSeconds: number; resendAfterSeconds: number }>(
      '/me/contact/otp',
      { method: 'POST', auth: true, body: { type, value, currentPassword } },
    ),

  verifyContact: (type: 'email' | 'mobile', value: string, code: string) =>
    apiFetch<{ profile: SettingsProfile }>('/me/contact/verify', {
      method: 'POST',
      auth: true,
      body: { type, value, code },
    }),

  changePassword: (currentPassword: string | undefined, newPassword: string) =>
    apiFetch<{ message: string; signedOutSessions: number }>('/me/password', {
      method: 'POST',
      auth: true,
      body: { currentPassword, newPassword },
    }),

  sessions: () => apiFetch<{ items: ActiveSession[] }>('/me/sessions', { auth: true }),

  revokeSession: (id: string) =>
    apiFetch<void>(`/me/sessions/${encodeURIComponent(id)}`, { method: 'DELETE', auth: true }),

  revokeOtherSessions: () =>
    apiFetch<{ revoked: number }>('/me/sessions', { method: 'DELETE', auth: true }),

  updateNotifications: (channels: Partial<NotificationChoices>) =>
    apiFetch<{ channels: NotificationChoices }>('/me/notification-preferences', {
      method: 'PATCH',
      auth: true,
      body: { channels },
    }),

  exportData: () => apiDownload('/me/data-export', 'trustlon-my-data.json', 'POST'),

  deleteAccount: (input: { confirm: string; currentPassword?: string; reason?: string }) =>
    apiFetch<{ message: string }>('/me/delete', { method: 'POST', auth: true, body: input }),
};
