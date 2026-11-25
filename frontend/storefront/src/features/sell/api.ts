import { apiFetch } from '@/lib/http';

export interface CommissionRates {
  defaultCommissionPercent: number;
  fees: {
    paymentFeePercent: number;
    gstOnFeesPercent: number;
    tcsPercent: number;
    tdsPercent: number;
  };
  gstRates: number[];
  categories: Array<{
    id: string;
    slug: string;
    name: string;
    nameHi: string | null;
    commissionPercent: number;
  }>;
}

export interface FeeBreakdown {
  categoryName: string | null;
  pricePaise: number;
  gstRateBps: number;
  commissionBps: number;
  gstCollectedPaise: number;
  commissionPaise: number;
  paymentFeePaise: number;
  gstOnFeesPaise: number;
  tcsPaise: number;
  tdsPaise: number;
  shippingPaise: number;
  totalDeductionsPaise: number;
  netPayoutPaise: number;
  netPercent: number;
}

export interface VendorLeadInput {
  contactName: string;
  businessName: string;
  mobile: string;
  email: string;
  city: string;
  categoryId?: string;
  gstin?: string;
}

export const sellApi = {
  commissionRates: (signal?: AbortSignal) =>
    apiFetch<CommissionRates>('/public/commission-rates', { signal }),

  calculate: (
    input: { pricePaise: number; categoryId?: string; gstRateBps: number; shippingPaise?: number },
    signal?: AbortSignal,
  ) => apiFetch<FeeBreakdown>('/public/fee-calculator', { method: 'POST', body: input, signal }),

  createLead: (input: VendorLeadInput) =>
    apiFetch<{ message: string }>('/public/vendor-leads', { method: 'POST', body: input }),
};
