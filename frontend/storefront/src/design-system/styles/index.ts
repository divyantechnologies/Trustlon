import { cn as cx } from '../utils/cn';

export const inputClass = (invalid: boolean) =>
  cx(
    'h-11 w-full rounded-lg border bg-white px-3 text-sm text-navy shadow-sm outline-none transition placeholder:text-slate-400',
    'focus:ring-4 disabled:cursor-not-allowed disabled:opacity-60',
    invalid
      ? 'border-red-600 focus:border-red-600 focus:ring-red-600/15'
      : 'border-slate-300 hover:border-slate-400 focus:border-teal focus:ring-teal/15',
  );

export const focusRing = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2';

/** Compose patterns with ordinary Tailwind layout utilities at the call site. */
export const layouts = {
  form: 'space-y-5',
  spaciousForm: 'space-y-6',
  pageGutter: 'px-6 sm:px-10',
} as const;
