const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** The API sends money in paise; show it in rupees. */
export const formatPrice = (paise: number) => rupees.format(paise / 100);
