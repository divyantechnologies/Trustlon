import { field } from '../../product/components/primitives';
export const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
export function GstinField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const invalid = Boolean(value && !GSTIN_PATTERN.test(value));
  return <label className="block text-sm">Business GSTIN (optional)<input value={value} maxLength={15} className={`${field} mt-2 focus-visible:ring-2 focus-visible:ring-teal-600`} aria-invalid={invalid} aria-describedby="gstin-help" onChange={e => onChange(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))} /><span id="gstin-help" className="mt-1 block text-slate-500">{invalid ? 'Enter a valid 15-character GSTIN.' : 'Used for your business invoice.'}</span></label>;
}
