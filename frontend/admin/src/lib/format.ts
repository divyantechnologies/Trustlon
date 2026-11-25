/** Formatting for the admin panel (Indian English, rupees, India time). */

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});
const inrWhole = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const number = new Intl.NumberFormat('en-IN');
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (paise: number | null | undefined) => inr.format((paise ?? 0) / 100);
export const moneyWhole = (paise: number | null | undefined) => inrWhole.format((paise ?? 0) / 100);
export const moneyCompact = (paise: number) => `₹${compact.format(paise / 100)}`;
export const count = (value: number | null | undefined) => number.format(value ?? 0);

const dateFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Kolkata',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: 'Asia/Kolkata',
});

export const date = (value: string | Date | null | undefined) =>
  value ? dateFormat.format(new Date(value)) : '—';
export const dateTime = (value: string | Date | null | undefined) =>
  value ? dateTimeFormat.format(new Date(value)) : '—';

/** "3 hours ago", "2 days ago". */
export function ago(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  const units: Array<[number, Intl.RelativeTimeFormatUnit]> = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
    [Infinity, 'year'],
  ];
  let amount = seconds;
  for (const [size, unit] of units) {
    if (Math.abs(amount) < size)
      return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-amount, unit);
    amount = Math.round(amount / size);
  }
  return dateFormat.format(new Date(value));
}

/** "PENDING_APPROVAL" → "Pending approval". */
export const humanize = (value: string | null | undefined) =>
  value ? value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ') : '—';

/** Today's date in India as YYYY-MM-DD. */
export const todayIst = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
export const shiftDate = (dateText: string, days: number) =>
  new Date(Date.parse(`${dateText}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** ISO time → value for <input type="datetime-local"> in the viewer's time zone. */
export function toLocalInput(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO time, or null when empty. */
export const fromLocalInput = (value: string): string | null =>
  value ? new Date(value).toISOString() : null;
