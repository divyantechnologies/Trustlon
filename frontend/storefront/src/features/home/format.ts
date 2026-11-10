const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const preciseRupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** The API sends money in paise; show it in rupees. */
export const formatPrice = (paise: number, { showPaise = false } = {}) =>
  (showPaise ? preciseRupees : rupees).format(paise / 100);
