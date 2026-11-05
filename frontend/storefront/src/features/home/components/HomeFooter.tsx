import Link from 'next/link';
import { BrandLogo } from '@/components/BrandLogo';
import { Icon } from './Icon';
const groups = [
  {
    title: 'Discover Trustlon',
    links: [
      ['About us', 'about'],
      ['Our story', 'story'],
      ['Careers', 'careers'],
      ['Sell on Trustlon', 'sell'],
    ],
  },
  {
    title: 'We’re here to help',
    links: [
      ['Help centre', 'help'],
      ['Track your order', 'orders'],
      ['Returns & refunds', 'returns'],
      ['Contact us', 'contact'],
    ],
  },
  {
    title: 'The important things',
    links: [
      ['Privacy policy', 'privacy'],
      ['Terms of use', 'terms'],
      ['Shipping policy', 'shipping'],
      ['Buyer protection', 'protection'],
    ],
  },
];
export function HomeFooter() {
  return (
    <footer className="bg-navy text-white">
      <div className="mx-auto max-w-7xl px-6 pb-6 pt-12 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
          <div>
            <BrandLogo inverted />
            <p className="mt-4 max-w-xs text-xs leading-6 text-white/60">
              A marketplace built around one simple idea: great shopping starts with trust.
            </p>
            <div className="mt-5 flex gap-3">
              {['Instagram', 'Facebook', 'YouTube'].map((social) => (
                <Link
                  key={social}
                  href={`/browse/${social.toLowerCase()}`}
                  aria-label={social}
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/20 text-xs font-semibold hover:bg-white/10"
                >
                  {social === 'Instagram' ? 'ig' : social === 'Facebook' ? 'f' : '▶'}
                </Link>
              ))}
            </div>
          </div>
          {groups.map((group) => (
            <div key={group.title}>
              <h3 className="mb-4 text-xs font-semibold">{group.title}</h3>
              <ul className="space-y-1">
                {group.links.map(([label, id]) => (
                  <li key={id}>
                    <Link
                      href={`/browse/${id}`}
                      className="inline-flex min-h-9 items-center text-xs text-white/60 hover:text-white"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h3 className="text-xs font-semibold">A little trust, on the go.</h3>
            <p className="mb-4 mt-3 text-xs leading-5 text-white/60">
              Your next favourite find is a tap away.
            </p>
            {['App Store', 'Google Play'].map((store) => (
              <Link
                key={store}
                href="/browse/app"
                className="mb-2 flex min-h-12 items-center gap-3 rounded-lg border border-white/20 px-4 py-2 hover:bg-white/10"
              >
                <Icon name="bag" className="h-5 w-5 text-logo-accent" />
                <span>
                  <span className="block text-[9px] text-white/60">COMING SOON ON</span>
                  <span className="text-sm font-medium">{store}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-6 text-[10px] text-white/50">
          <p>
            © {new Date().getFullYear()} Trustlon. All rights reserved. · Frontend demonstration.
          </p>
          <p className="flex items-center gap-2">
            <Icon name="lock" className="h-3 w-3" />
            Thoughtfully built. Secure by design.
          </p>
        </div>
      </div>
    </footer>
  );
}
