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
import type { Dictionary } from '@/lib/i18n/en';
import { useI18n } from '@/lib/i18n/language-provider';
import { useSiteConfig } from '@/lib/site-config';
import { Skeleton } from './ui';

type NavKey = Exclude<keyof Dictionary['accountNav'], 'label' | 'signOut'>;
type NavItem = { key: NavKey; href: string; count?: 'wishlist' };

/** Sections from the build spec. Labels come from the language dictionary. */
const NAV: NavItem[] = [
  { key: 'overview', href: '/account' },
  { key: 'orders', href: '/account/orders' },
  { key: 'returns', href: '/account/returns' },
  { key: 'wishlist', href: '/account/wishlist', count: 'wishlist' },
  { key: 'priceAlerts', href: '/account/price-alerts' },
  { key: 'addresses', href: '/account/addresses' },
  { key: 'wallet', href: '/account/wallet' },
  { key: 'reviews', href: '/account/reviews' },
  { key: 'b2b', href: '/account/b2b' },
  { key: 'refer', href: '/account/affiliate' },
  { key: 'support', href: '/account/support' },
  { key: 'settings', href: '/account/settings' },
];

const itemClass =
  'flex min-h-11 w-full shrink-0 items-center justify-between gap-3 whitespace-nowrap rounded-lg px-3 text-start text-sm';

function AccountSidebar({ onSignOut }: { onSignOut: () => void }) {
  const { user } = useAuth();
  const pathname = usePathname();
  const home = useHome();
  const { t } = useI18n();
  const { features } = useSiteConfig().config;
  const nav = NAV.filter((item) => item.key !== 'refer' || features.referralProgram);

  const isActive = (href: string) =>
    href === '/account'
      ? pathname === '/account'
      : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav aria-label={t.accountNav.label} className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-0.5 lg:overflow-visible lg:rounded-lg lg:border lg:border-slate-200 lg:bg-white lg:p-2">
        {nav.map((item) => (
          <li key={item.key}>
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
              {t.accountNav[item.key]}
              {item.count === 'wishlist' && home.wishlist.length > 0 && (
                <span
                  className={cn(
                    'rounded-full px-2 text-xs',
                    isActive(item.href) ? 'bg-white/15 text-white' : 'bg-teal-50 text-teal-600',
                  )}
                >
                  {home.wishlist.length}
                </span>
              )}
            </Link>
          </li>
        ))}
        {user?.role === 'VENDOR_OWNER' && (
          <li>
            <Link
              href="/account/seller"
              aria-current={isActive('/account/seller') ? 'page' : undefined}
              className={cn(
                itemClass,
                focusRing,
                isActive('/account/seller')
                  ? 'bg-navy font-semibold text-white'
                  : 'bg-white text-navy hover:bg-navy-50 lg:bg-transparent',
              )}
            >
              Seller delivery
            </Link>
          </li>
        )}
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
            {t.accountNav.signOut}
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
