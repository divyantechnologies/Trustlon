'use client';
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn, focusRing, inputClass } from '@/design-system';
import { BrandLogo } from '@/components/BrandLogo';
import { useI18n } from '@/lib/i18n/language-provider';
import { useAuth } from '@/features/auth';
import { homeApi } from '../api';
import { useHome } from '../home-provider';
import type { Suggestions } from '../types';
import { Icon } from './Icon';
export function HomeHeader() {
  const home = useHome();
  const { language, setLanguage } = useI18n();
  const hi = language === 'hi';
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const router = useRouter();
  const accountRef = useRef<HTMLDetailsElement>(null);
  const auth = useAuth();
  const [results, setResults] = useState<Suggestions | null>(null);
  useEffect(() => {
    if (!focused) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      homeApi
        .suggest(query, controller.signal)
        .then(setResults)
        .catch(() => undefined);
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, focused]);
  const suggestions = results?.products ?? [];
  const count = home.cartCount;
  const select = (name: string) => {
    setQuery(name);
    setFocused(false);
    setActive(-1);
    router.push(`/browse/search?q=${encodeURIComponent(name)}`);
  };
  return (
    <header className="relative z-30 bg-white">
      <div className="border-b border-slate-100 bg-navy-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-2 text-xs sm:px-6 lg:px-8">
          <span className="flex items-center gap-2">
            <Icon name="shield" className="h-3.5 w-3.5 text-teal-600" />
            {hi ? 'हर खरीदारी में भरोसा।' : 'A little more trust in every purchase.'}
          </span>
          <span className="hidden text-slate-500 sm:block">Discover. Shop. Feel good.</span>
          <span className="text-slate-500">Escrow-protected payments</span>
        </div>
      </div>
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-x-5 gap-y-3 px-4 py-4 sm:px-6 lg:grid-cols-[auto_auto_minmax(0,1fr)_auto] lg:px-8 lg:py-5">
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
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            setFocused(false);
            router.push(`/browse/search?q=${encodeURIComponent(query.trim())}`);
          }}
          className="relative col-span-2 lg:col-span-1"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setFocused(false);
          }}
        >
          <label htmlFor="marketplace-search" className="sr-only">
            {hi ? 'उत्पाद खोजें' : 'Search products'}
          </label>
          <input
            id="marketplace-search"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={focused}
            aria-controls={listId}
            aria-activedescendant={active >= 0 && focused ? `${listId}-${active}` : undefined}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(-1);
              setFocused(true);
            }}
            onFocus={() => setFocused(true)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setFocused(false);
                setActive(-1);
              }
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setFocused(true);
                setActive((index) => Math.min(index + 1, suggestions.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((index) => Math.max(index - 1, 0));
              }
              if (e.key === 'Enter' && focused && active >= 0 && suggestions[active]) {
                e.preventDefault();
                select(suggestions[active].name);
              }
            }}
            placeholder={
              hi ? 'उत्पाद, ब्रांड और स्टोर खोजें' : 'Search for products, brands and more'
            }
            className={cn(inputClass(false), 'pr-12')}
          />
          <button
            type="submit"
            aria-label="Search"
            className={cn(
              'absolute right-0 top-0 flex h-11 w-11 items-center justify-center rounded-lg text-navy',
              focusRing,
            )}
          >
            <Icon name="search" />
          </button>
          {focused && (
            <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              <p className="px-3 py-2 text-xs uppercase tracking-wider text-slate-500">
                {results?.query ? 'Matching products' : 'Popular right now'}
              </p>
              <ul id={listId} role="listbox" aria-label="Search suggestions">
                {suggestions.map((product, index) => (
                  <li
                    key={product.id}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={index === active}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(product.name)}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 hover:bg-navy-50',
                      index === active && 'bg-navy-50',
                    )}
                  >
                    <Icon name="search" className="h-4 w-4 shrink-0 text-slate-500" />
                    {product.name}
                  </li>
                ))}
              </ul>
              {results && !suggestions.length && (
                <p className="px-3 py-4 text-slate-500">
                  No matching products. Press Enter to search everything.
                </p>
              )}
              {results && results.categories.length + results.stores.length > 0 && (
                <div className="mt-1 border-t border-slate-100 pt-2">
                  {[
                    ...results.categories.map((c) => ({ ...c, kind: 'Category' })),
                    ...results.stores.map((st) => ({ ...st, kind: 'Store' })),
                  ].map((item) => (
                    <Link
                      key={`${item.kind}-${item.slug}`}
                      href={item.kind === 'Category' ? `/c/${encodeURIComponent(item.slug)}` : `/browse/${item.slug}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => setFocused(false)}
                      className="flex min-h-11 items-center justify-between rounded-lg px-3 py-2 hover:bg-navy-50"
                    >
                      <span>{item.name}</span>
                      <span className="text-xs text-slate-500">{item.kind}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </form>
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
