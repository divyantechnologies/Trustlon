import { calculateFees, PLATFORM_DEFAULT_COMMISSION_BPS } from './fees';

describe('calculateFees', () => {
  it('breaks a ₹1,180 sale at 18% GST into fees and payout', () => {
    const result = calculateFees({
      pricePaise: 118_000,
      commissionBps: PLATFORM_DEFAULT_COMMISSION_BPS,
      gstRateBps: 1800,
    });
    expect(result.gstCollectedPaise).toBe(18_000);
    expect(result.commissionPaise).toBe(11_800);
    expect(result.paymentFeePaise).toBe(2_360);
    expect(result.gstOnFeesPaise).toBe(2_549);
    expect(result.tcsPaise).toBe(500);
    expect(result.tdsPaise).toBe(118);
    expect(result.netPayoutPaise).toBe(118_000 - 11_800 - 2_360 - 2_549 - 500 - 118);
    expect(result.netPercent).toBe(85.3);
  });

  it('subtracts the seller’s shipping cost', () => {
    const base = calculateFees({ pricePaise: 50_000, commissionBps: 500, gstRateBps: 0 });
    const shipped = calculateFees({
      pricePaise: 50_000,
      commissionBps: 500,
      gstRateBps: 0,
      shippingPaise: 4_000,
    });
    expect(base.netPayoutPaise - shipped.netPayoutPaise).toBe(4_000);
    expect(base.gstCollectedPaise).toBe(0);
  });
});
