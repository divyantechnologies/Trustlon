'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { cn, focusRing } from '@/design-system';
import { useAuth } from '@/features/auth';
import { CategoryNav } from '@/features/home/components/CategoryNav';
import { HomeFooter } from '@/features/home/components/HomeFooter';
import { HomeHeader } from '@/features/home/components/HomeHeader';
import { MarketplaceDialogs } from '@/features/home/components/MarketplaceDialogs';
import { useHome } from '@/features/home/home-provider';
import { Skeleton } from './ui';

type NavItem =
  | { label: string; href: string }
  | { label: string; action: 'wishlist' }
  | { label: string; soon: true };

/** Sections from the build spec. Items marked soon are listed so customers know they are coming. */
const NAV: NavItem[] = [
  { label: 'Overview', href: '/account' },
  { label: 'Orders', href: '/account/orders' },
  { label: 'Returns', soon: true },
  { label: 'Wishlist', action: 'wishlist' },
  { label: 'Price alerts', soon: true },
  { label: 'Addresses', soon: true },
  { label: 'Wallet', soon: true },
  { label: 'Reviews', soon: true },
  { label: 'B2B', soon: true },
  { label: 'Affiliate', soon: true },
  { label: 'Support', soon: true },
  { label: 'Settings', soon: true },
];

const itemClass =
  'flex min-h-11 w-full shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 text-left text-sm';

function AccountSidebar({ onSignOut }: { onSignOut: () => void }) {
  const pathname = usePathname();
  const home = useHome();

  const isActive = (href: string) =>
    href === '/account'
      ? pathname === '/account'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label="My account" className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:p-2">
        {NAV.map((item) => (
          <li key={item.label} className={'soon' in item ? 'hidden lg:block' : undefined}>
            {'href' in item ? (
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  itemClass,
                  focusRing,
                  isActive(item.href)
                    ? 'bg-navy font-semibold text-white'
                    : 'bg-white text-navy hover:bg-navy-50 lg:bg-transparent',
                )}
              >
                {item.label}
              </Link>
            ) : 'action' in item ? (
              <button
                type="button"
                onClick={() => home.setPanel('wishlist')}
                className={cn(
                  itemClass,
                  focusRing,
                  'bg-white text-navy hover:bg-navy-50 lg:bg-transparent',
                )}
              >
                {item.label}
                {home.wishlist.length > 0 && (
                  <span className="rounded-full bg-teal-50 px-2 text-xs text-teal-600">
                    {home.wishlist.length}
                  </span>
                )}
              </button>
            ) : (
              <span
                aria-disabled="true"
                className={cn(
                  itemClass,
                  'cursor-default bg-white text-slate-400 lg:bg-transparent',
                )}
              >
                {item.label}
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                  Soon
                </span>
              </span>
            )}
          </li>
        ))}
        <li className="lg:mt-2 lg:border-t lg:border-slate-100 lg:pt-2">
          <button
            type="button"
            onClick={onSignOut}
            className={cn(
              itemClass,
              focusRing,
              'bg-white text-slate-600 hover:bg-navy-50 lg:bg-transparent',
            )}
          >
            Sign out
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Header, account navigation and footer around every /account page. Sends guests to sign in. */
export function AccountShell({ children }: { children: React.ReactNode }) {
  const { status, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const signingOut = useRef(false);

  useEffect(() => {
    if (status === 'guest' && !signingOut.current) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [status, pathname, router]);

  const signOut = () => {
    signingOut.current = true;
    router.replace('/');
    void logout();
  };

  return (
    <>
      <HomeHeader />
      <CategoryNav />
      <main className="mx-auto min-h-[60vh] max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        {status === 'authenticated' ? (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8">
            <AccountSidebar onSignOut={signOut} />
            <div className="min-w-0">{children}</div>
          </div>
        ) : (
          <div
            className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-8"
            aria-busy="true"
          >
            <Skeleton className="hidden h-96 lg:block" />
            <div className="space-y-4">
              <Skeleton className="h-8 w-56" />
              <Skeleton className="h-40" />
              <Skeleton className="h-64" />
            </div>
            <p className="sr-only" role="status">
              {status === 'guest' ? 'Redirecting to sign in…' : 'Loading your account…'}
            </p>
          </div>
        )}
      </main>
      <HomeFooter />
      <MarketplaceDialogs />
    </>
  );
}
