import { Vendor } from '@prisma/client';

export interface StoreSummary {
  slug: string;
  name: string;
  initials: string;
  tagline: string | null;
  logo: string | null;
  image: string | null;
  trustScore: number;
  isVerified: boolean;
  isPlatformOwned: boolean;
}

export interface LocalSeller extends StoreSummary {
  area: string | null;
  category: string | null;
  pincode: string;
  distanceKm: number;
  sameDayDelivery: boolean;
}

export function toStoreSummary(vendor: Vendor): StoreSummary {
  return {
    slug: vendor.slug,
    name: vendor.displayName,
    initials: vendor.initials,
    tagline: vendor.tagline,
    logo: vendor.logoUrl,
    image: vendor.bannerUrl,
    trustScore: vendor.trustScore,
    isVerified: vendor.isVerified,
    isPlatformOwned: vendor.isPlatformOwned,
  };
}
