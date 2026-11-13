'use client';
import Link from 'next/link';
import { useRef } from 'react';
import { cn, focusRing } from '@/design-system';
import { BrandLogo } from '@/components/BrandLogo';
import { useI18n } from '@/lib/i18n/language-provider';
import { useAuth } from '@/features/auth';
import { SearchBar } from '../../search/SearchBar';
import { useHome } from '../home-provider';
import { Icon } from './Icon';
export function HomeHeader({ searchQuery = '' }: { searchQuery?: string }) {
  const home = useHome();
  const { language, setLanguage } = useI18n();
  const hi = language === 'hi';
  const accountRef = useRef<HTMLDetailsElement>(null);
  const auth = useAuth();
  const count = home.cartCount;
  return (
    <header className="relative z-30 bg-white">
      <div className="border-b border-slate-100 bg-navy-50">
        <div className="flex w-full items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
          <span className="flex items-center gap-2">
            <Icon name="shield" className="h-3.5 w-3.5 text-teal-600" />
            {hi ? 'हर खरीदारी में भरोसा।' : 'A little more trust in every purchase.'}
          </span>
          <span className="hidden text-slate-500 sm:block">Discover. Shop. Feel good.</span>
          <span className="text-slate-500">Escrow-protected payments</span>
        </div>
      </div>
      <div className="grid w-full grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:px-8 lg:py-5">
        <BrandLogo />
        <button
          onClick={() => home.setPanel('pincode')}
          className={cn(
            'col-span-2 flex items-center gap-2 rounded-lg text-left lg:col-span-1',
            focusRing,
          )}
          aria-label={`Change delivery pincode, currently ${home.pincode}`}
        >
          <Icon name="pin" className="h-5 w-5 text-teal-600" />
          <span>
            <span className="text-xs text-slate-500">{hi ? 'डिलीवरी पिनकोड' : 'Deliver to'}</span>
            <span className="ml-2 font-semibold lg:ml-0 lg:block">
              {home.pincode} <span className="text-xs font-normal text-teal-600">Change</span>
            </span>
          </span>
        </button>
        <SearchBar initialQuery={searchQuery} />
        <div className="col-start-2 row-start-1 flex items-center gap-1 sm:gap-3 lg:col-start-4">
          <button
            onClick={() => setLanguage(hi ? 'en' : 'hi')}
            aria-label={hi ? 'Switch to English' : 'हिन्दी में देखें'}
            className={cn('h-11 rounded-lg px-2 text-xs font-semibold', focusRing)}
          >
            {hi ? 'हिन्दी' : 'EN'} <span aria-hidden>⌄</span>
          </button>
          <details
            ref={accountRef}
            className="relative"
            onKeyDown={(e) => {
              if (e.key === 'Escape' && accountRef.current) {
                accountRef.current.open = false;
                accountRef.current.querySelector('summary')?.focus();
              }
            }}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node) && accountRef.current)
                accountRef.current.open = false;
            }}
          >
            <summary
              aria-label="Account menu"
              className={cn(
                'flex h-11 cursor-pointer list-none items-center gap-2 rounded-lg px-2 [&::-webkit-details-marker]:hidden',
                focusRing,
              )}
            >
              <Icon name="user" />
              <span className="hidden text-xs font-medium xl:block">{hi ? 'खाता' : 'Account'}</span>
            </summary>
            <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <p className="px-3 py-2 font-semibold">
                {auth.user ? `Hi, ${auth.user.fullName.split(' ')[0]}` : 'Welcome to Trustlon'}
              </p>
              {auth.status === 'guest' && (
                <div className="space-y-2 px-3 pb-3">
                  <Link
                    href="/login"
                    className="flex h-11 items-center justify-center rounded-lg bg-navy text-sm font-semibold text-white hover:bg-navy-700"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/signup"
                    className="block text-center text-xs font-semibold text-teal-600 hover:underline"
                  >
                    Create an account
                  </Link>
                </div>
              )}
              {[
                ['My account', '/account'],
                ['My orders', '/account/orders'],
                ['Help centre', '/browse/help'],
              ].map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => {
                    if (accountRef.current) accountRef.current.open = false;
                  }}
                  className="block rounded-lg px-3 py-3 hover:bg-navy-50"
                >
                  {label}
                </Link>
              ))}
              {auth.status === 'authenticated' && (
                <button
                  onClick={() => {
                    if (accountRef.current) accountRef.current.open = false;
                    void auth.logout();
                  }}
                  className="block w-full rounded-lg border-t border-slate-100 px-3 py-3 text-left text-sm hover:bg-navy-50"
                >
                  Sign out
                </button>
              )}
            </div>
          </details>
          <button
            onClick={() => home.setPanel('wishlist')}
            aria-label={`Wishlist, ${home.wishlist.length} items`}
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-lg',
              focusRing,
            )}
          >
            <Icon name="heart" />
            {home.wishlist.length > 0 && (
              <span className="absolute right-0 top-0 rounded-full bg-teal-50 px-1.5 text-xs text-teal-600">
                {home.wishlist.length}
              </span>
            )}
          </button>
          <button
            onClick={() => home.setPanel('cart')}
            aria-label={`Shopping cart, ${count} items`}
            className={cn(
              'relative flex h-11 w-11 items-center justify-center rounded-lg',
              focusRing,
            )}
          >
            <Icon name="cart" />
            <span className="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full bg-navy px-1 text-[10px] text-white">
              {count}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
