import { VendorStatus } from '@prisma/client';
import { boundingBox, distanceKm } from '../../common/utils/geo';
import { deliveryPromise, localEligibility } from './local-rules';

const now = new Date('2026-11-17T08:29:59Z'); // 13:59:59 IST
const vendor = {
  status: VendorStatus.ACTIVE,
  deletedAt: null,
  kycApprovedAt: now,
  sameDayDelivery: true,
  pickupLat: 28.8386,
  pickupLng: 78.7733,
  pickup: null,
  deliveryCutoffTime: '14:00',
  nextDayDelivery: true,
};

describe('local seller eligibility', () => {
  it('uses zero distance and symmetric great-circle distance', () => {
    expect(distanceKm(28.8, 78.7, 28.8, 78.7)).toBe(0);
    expect(distanceKm(28.8, 78.7, 29, 79)).toBeCloseTo(distanceKm(29, 79, 28.8, 78.7), 10);
    expect(distanceKm(0, 0, 0, 1)).toBeCloseTo(111.195, 3);
  });

  it('compares exact distances rather than one-decimal displayed distances', () => {
    const at = (km: number) => ({
      ...vendor,
      pickupLat: vendor.pickupLat + ((km / 6371) * 180) / Math.PI,
    });
    expect(localEligibility(at(4.999), vendor.pickupLat, vendor.pickupLng, 5, now)).not.toBeNull();
    expect(localEligibility(at(5.01), vendor.pickupLat, vendor.pickupLng, 5, now)).toBeNull();
    const box = boundingBox(vendor.pickupLat, vendor.pickupLng, 25);
    expect(at(25).pickupLat).toBeLessThan(box.maxLat);
  });

  it.each([
    { sameDayDelivery: false },
    { status: VendorStatus.PENDING },
    { status: VendorStatus.SUSPENDED },
    { deletedAt: now },
    { kycApprovedAt: null },
    { pickupLat: null, pickupLng: null },
  ])('excludes ineligible vendors: %j', (change) => {
    expect(localEligibility({ ...vendor, ...change }, 28.8386, 78.7733, 10, now)).toBeNull();
  });

  it('uses existing pincode coordinates when pickup coordinates are not yet stored', () => {
    expect(
      localEligibility(
        {
          ...vendor,
          pickupLat: null,
          pickupLng: null,
          pickup: { latitude: 28.8386, longitude: 78.7733 },
        },
        28.8386,
        78.7733,
        5,
        now,
      )?.distanceKm,
    ).toBe(0);
  });

  it('honours the exact India-time cutoff and explicit next-day support', () => {
    expect(deliveryPromise(vendor, now)).toBe('same_day');
    const cutoff = new Date('2026-11-17T08:30:00Z');
    expect(deliveryPromise(vendor, cutoff)).toBe('next_day');
    expect(deliveryPromise({ ...vendor, nextDayDelivery: false }, cutoff)).toBeNull();
    expect(deliveryPromise({ ...vendor, sameDayDelivery: false }, now)).toBeNull();
    expect(deliveryPromise({ ...vendor, deliveryCutoffTime: null }, cutoff)).toBe('same_day');
    expect(deliveryPromise(vendor, new Date('2026-11-17T18:30:00Z'))).toBe('same_day');
  });
});
