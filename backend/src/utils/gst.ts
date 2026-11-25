/** Splits a GST-inclusive amount in paise into taxable value and tax. Rates are in basis points. */
export function splitGst(
  totalPaise: number,
  rateBps: number,
): { taxablePaise: number; gstPaise: number } {
  const taxablePaise = Math.round((totalPaise * 10_000) / (10_000 + rateBps));
  return { taxablePaise, gstPaise: totalPaise - taxablePaise };
}
