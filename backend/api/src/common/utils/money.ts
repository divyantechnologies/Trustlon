/** All money in the API is integer paise. 1 rupee = 100 paise. */
export const CURRENCY = 'INR';

export function discountPercent(pricePaise: number, mrpPaise: number): number {
  if (mrpPaise <= 0 || pricePaise >= mrpPaise) return 0;
  return Math.round((1 - pricePaise / mrpPaise) * 100);
}
