import { Icon, type IconName } from './Icon';
const assurances: { icon: IconName; title: string; body: string }[] = [
  {
    icon: 'shield',
    title: 'Escrow Protection',
    body: 'Your money stays protected until your order arrives.',
  },
  {
    icon: 'check',
    title: 'Verified Sellers',
    body: 'Shop with confidence from verified businesses.',
  },
  {
    icon: 'return',
    title: 'Easy Returns',
    body: 'Not quite right? We make getting it right simple.',
  },
  {
    icon: 'lock',
    title: 'Secure Payments',
    body: 'Your payment details are always in safe hands.',
  },
];
export function TrustStrip() {
  return (
    <section aria-label="The Trustlon promise" className="border-y border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 py-10 sm:grid-cols-2 lg:grid-cols-4 lg:px-8">
        {assurances.map((item) => (
          <div key={item.title} className="flex gap-4">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
              <Icon name={item.icon} />
            </span>
            <div>
              <h3 className="font-semibold">{item.title}</h3>
              <p className="mt-2 text-xs leading-5 text-slate-500">{item.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
