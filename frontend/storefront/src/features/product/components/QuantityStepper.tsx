'use client';

export function QuantityStepper({ value, min = 1, max = Infinity, onChange }: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  const lower = Math.max(1, Math.ceil(min));
  const upper = Math.max(lower, Math.floor(max));
  const current = Math.min(upper, Math.max(lower, Math.floor(value) || lower));
  const control = 'h-11 w-11 shrink-0 text-lg font-semibold transition hover:bg-teal-50 active:bg-teal-100 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-300';

  return (
    <div role="group" aria-label="Quantity" className="inline-flex rounded-xl border border-slate-300 bg-white text-[#12203F]">
      <button type="button" aria-label="Decrease quantity" disabled={current <= lower}
        className={`${control} rounded-l-xl`} onClick={() => onChange(current - 1)}>
        −
      </button>
      <input aria-label="Quantity" type="number" readOnly value={current} min={lower}
        max={Number.isFinite(upper) ? upper : undefined}
        className="h-11 w-12 appearance-none border-x border-slate-200 bg-transparent text-center text-sm font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-600 [appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden" />
      <button type="button" aria-label="Increase quantity" disabled={current >= upper}
        className={`${control} rounded-r-xl`} onClick={() => onChange(current + 1)}>
        +
      </button>
    </div>
  );
}
