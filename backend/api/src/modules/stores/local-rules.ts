import { Vendor } from '@prisma/client';
import { distanceKm } from '../../common/utils/geo';

export const LOCAL_RADII_KM = [5, 10, 25] as const;
export type LocalRadius = (typeof LOCAL_RADII_KM)[number];
export type DeliveryPromise = 'same_day' | 'next_day';

type LocalVendor = Pick<
  Vendor,
  | 'status'
  | 'deletedAt'
  | 'kycApprovedAt'
  | 'sameDayDelivery'
  | 'pickupLat'
  | 'pickupLng'
  | 'deliveryCutoffTime'
  | 'nextDayDelivery'
> & {
  pickup: { latitude: number | null; longitude: number | null } | null;
};

export function deliveryPromise(
  vendor: Pick<LocalVendor, 'sameDayDelivery' | 'deliveryCutoffTime' | 'nextDayDelivery'>,
  now: Date,
): DeliveryPromise | null {
  if (!vendor.sameDayDelivery) return null;
  const india = new Date(now.getTime() + 330 * 60_000);
  const minutes = india.getUTCHours() * 60 + india.getUTCMinutes();
  const cutoff = vendor.deliveryCutoffTime;
  if (!cutoff || minutes < Number(cutoff.slice(0, 2)) * 60 + Number(cutoff.slice(3)))
    return 'same_day';
  return vendor.nextDayDelivery ? 'next_day' : null;
}

/** Compare the exact distance; rounding is presentation only. */
export function localEligibility(
  vendor: LocalVendor,
  lat: number,
  lng: number,
  radius: LocalRadius,
  now: Date,
) {
  if (vendor.status !== 'ACTIVE' || vendor.deletedAt || !vendor.kycApprovedAt) return null;
  const promise = deliveryPromise(vendor, now);
  const pickupLat = vendor.pickupLat ?? vendor.pickup?.latitude;
  const pickupLng = vendor.pickupLng ?? vendor.pickup?.longitude;
  if (!promise || pickupLat == null || pickupLng == null) return null;
  const km = distanceKm(lat, lng, pickupLat, pickupLng);
  return Number.isFinite(km) && km <= radius ? { distanceKm: km, deliveryPromise: promise } : null;
}
