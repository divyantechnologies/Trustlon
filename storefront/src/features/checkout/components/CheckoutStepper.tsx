export function CheckoutStepper({ step }: { step: number }) {
  return <nav aria-label="Checkout steps"><ol className="grid grid-cols-4 gap-2">{['Address', 'Delivery', 'Payment', 'Review'].map((label, index) => <li key={label} aria-current={index === step ? 'step' : undefined} className={`rounded-xl border px-2 py-3 text-center text-xs font-semibold sm:text-sm ${index === step ? 'border-teal-600 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-500'}`}><span aria-hidden="true">{index + 1}. </span>{label}</li>)}</ol></nav>;
}
