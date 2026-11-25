export interface VendorRow {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  plan: string;
  status: string;
  kycStatus: string;
  trustScore: number;
  isVerified: boolean;
  isPlatformOwned: boolean;
  underReview: boolean;
  payoutsOnHold: boolean;
  gmvPaise: number;
  email: string | null;
  joinedAt: string;
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface VendorDetail {
  id: string;
  slug: string;
  name: string;
  legalName: string | null;
  gstin: string | null;
  plan: string;
  status: string;
  isVerified: boolean;
  isPlatformOwned: boolean;
  trustScore: number;
  commissionPercent: number | null;
  payoutsOnHold: boolean;
  payoutHoldReason: string | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  underReview: boolean;
  pickupPincode: string | null;
  logoUrl: string | null;
  joinedAt: string;
  kycApprovedAt: string | null;
  owner: { id: string; fullName: string; email: string; mobile: string } | null;
  gmvPaise: number;
  kyc: {
    status: string;
    pan: string | null;
    panName: string | null;
    panCheck: string;
    gstin: string | null;
    gstinLegalName: string | null;
    gstinCheck: string;
    bankAccount: string | null;
    ifsc: string | null;
    bankName: string | null;
    pennyDropName: string | null;
    pennyDropCheck: string;
    nameMatch: boolean | null;
    submittedAt: string | null;
    reviewedAt: string | null;
    rejectionReasons: string[];
    requestedDocuments: string[];
    reviewNote: string | null;
  } | null;
  documents: Array<{
    id: string;
    type: string;
    fileName: string | null;
    contentType: string;
    sizeBytes: number;
    uploadedAt: string;
  }>;
  products: {
    counts: Record<string, number>;
    recent: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      pricePaise: number;
      stock: number;
      imageUrl: string;
    }>;
  };
  orders: {
    counts: Record<string, number>;
    recent: Array<{
      id: string;
      subOrderNumber: string;
      status: string;
      totalPaise: number;
      createdAt: string;
      orderId: string;
    }>;
  };
  trustScoreHistory: Array<{ date: string; score: number }>;
  notes: Array<{ id: string; kind: string; body: string; by: string; at: string }>;
}

export const DOCUMENT_TYPES: Record<string, string> = {
  PAN_CARD: 'PAN card',
  GST_CERTIFICATE: 'GST certificate',
  CANCELLED_CHEQUE: 'Cancelled cheque',
  ADDRESS_PROOF: 'Address proof',
  BRAND_AUTHORISATION: 'Brand authorisation',
  OTHER: 'Other document',
};
