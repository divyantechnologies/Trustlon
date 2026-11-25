/**
 * Seller fees shown on the /sell page (spec 3.12) and used by vendor payouts (7.2).
 *
 * The rates below are only defaults: Finance changes the live values in /admin > Business
 * settings (site_settings table), and the service passes them in. All amounts are in paise.
 */

/** Used when neither the category nor its parent sets `commissionBps`. 1000 = 10%. */
export const PLATFORM_DEFAULT_COMMISSION_BPS = 1000;
/** Payment gateway and collection cost passed on to the seller, on the selling price. */
export const PAYMENT_FEE_BPS = 200;
/** GST charged on Trustlon's commission and fees. */
export const GST_ON_FEES_BPS = 1800;
/** GST TCS collected by the marketplace on the taxable value (0.5%). Claimable by the seller. */
export const TCS_BPS = 50;
/** Income-tax TDS deducted by the marketplace on the gross amount (0.1%). Claimable. */
export const TDS_BPS = 10;
/** GST slabs a product can carry. */
export const PRODUCT_GST_RATES_BPS = [0, 500, 1800, 4000] as const;

export const MIN_PRICE_PAISE = 100;
export const MAX_PRICE_PAISE = 1_00_00_000_00;

export interface FeeBreakdown {
  pricePaise: number;
  gstRateBps: number;
  commissionBps: number;
  /** GST inside the selling price that the seller files and pays. */
  gstCollectedPaise: number;
  commissionPaise: number;
  paymentFeePaise: number;
  gstOnFeesPaise: number;
  tcsPaise: number;
  tdsPaise: number;
  shippingPaise: number;
  /** Everything Trustlon keeps or deducts, including tax credits the seller can claim. */
  totalDeductionsPaise: number;
  netPayoutPaise: number;
  /** Net payout as a share of the selling price, one decimal. */
  netPercent: number;
}

const share = (amount: number, bps: number) => Math.round((amount * bps) / 10_000);

export interface FeeRates {
  paymentFeeBps: number;
  gstOnFeesBps: number;
  tcsBps: number;
  tdsBps: number;
}

export const DEFAULT_FEE_RATES: FeeRates = {
  paymentFeeBps: PAYMENT_FEE_BPS,
  gstOnFeesBps: GST_ON_FEES_BPS,
  tcsBps: TCS_BPS,
  tdsBps: TDS_BPS,
};

export function calculateFees(
  input: {
    pricePaise: number;
    commissionBps: number;
    gstRateBps: number;
    shippingPaise?: number;
  },
  rates: FeeRates = DEFAULT_FEE_RATES,
): FeeBreakdown {
  const { pricePaise, commissionBps, gstRateBps } = input;
  const shippingPaise = input.shippingPaise ?? 0;
  const taxable = Math.round((pricePaise * 10_000) / (10_000 + gstRateBps));
  const commissionPaise = share(pricePaise, commissionBps);
  const paymentFeePaise = share(pricePaise, rates.paymentFeeBps);
  const gstOnFeesPaise = share(commissionPaise + paymentFeePaise, rates.gstOnFeesBps);
  const tcsPaise = share(taxable, rates.tcsBps);
  const tdsPaise = share(pricePaise, rates.tdsBps);
  const totalDeductionsPaise =
    commissionPaise + paymentFeePaise + gstOnFeesPaise + tcsPaise + tdsPaise + shippingPaise;
  const netPayoutPaise = pricePaise - totalDeductionsPaise;
  return {
    pricePaise,
    gstRateBps,
    commissionBps,
    gstCollectedPaise: pricePaise - taxable,
    commissionPaise,
    paymentFeePaise,
    gstOnFeesPaise,
    tcsPaise,
    tdsPaise,
    shippingPaise,
    totalDeductionsPaise,
    netPayoutPaise,
    netPercent: Math.round((netPayoutPaise / pricePaise) * 1000) / 10,
  };
}
