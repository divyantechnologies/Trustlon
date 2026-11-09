import { boundingBox, distanceKm } from './geo';
import { discountPercent } from './money';

describe('geo and money utils', () => {
  it('measures distance between two Bengaluru points', () => {
    const km = distanceKm(12.9719, 77.6070, 12.9784, 77.6408);
    expect(km).toBeGreaterThan(3);
    expect(km).toBeLessThan(4.5);
  });

  it('builds a bounding box that contains the radius', () => {
    const box = boundingBox(12.97, 77.6, 10);
    expect(box.maxLat - box.minLat).toBeCloseTo(0.18, 2);
    expect(box.minLng).toBeLessThan(77.6);
  });

  it('calculates discount percent', () => {
    expect(discountPercent(249900, 499900)).toBe(50);
    expect(discountPercent(500, 500)).toBe(0);
    expect(discountPercent(100, 0)).toBe(0);
  });
});
