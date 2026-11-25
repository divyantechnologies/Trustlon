'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { focusRing } from '@/design-system';
import { cn } from '@/design-system/utils/cn';
import { useAuth } from '@/features/auth/auth-provider';
import type { Permission } from '@/features/auth/api';
import { humanize } from '@/lib/format';
import { BrandLogo } from './BrandLogo';
import { Loading } from './ui';

interface NavItem {
  label: string;
  href: string;
  permission: Permission;
}

/** The admin panel's sections (spec 0 site map, Admin rows). */
export const NAV: Array<{ group: string; items: NavItem[] }> = [
  { group: '', items: [{ label: 'Dashboard', href: '/', permission: 'dashboard:view' }] },
  {
    group: 'Vendors',
    items: [
      { label: 'All vendors', href: '/vendors', permission: 'vendors:view' },
      { label: 'KYC queue', href: '/vendors/kyc', permission: 'vendors:view' },
    ],
  },
  {
    group: 'Catalog',
    items: [
      { label: 'Product moderation', href: '/catalog/products', permission: 'products:view' },
      { label: 'Categories', href: '/catalog/categories', permission: 'catalog:view' },
      { label: 'Attributes', href: '/catalog/attributes', permission: 'catalog:view' },
      { label: 'HSN and GST', href: '/catalog/hsn', permission: 'catalog:view' },
    ],
  },
  {
    group: 'Sales',
    items: [
      { label: 'Orders', href: '/orders', permission: 'orders:view' },
      { label: 'Customers', href: '/customers', permission: 'customers:view' },
    ],
  },
  {
    group: 'Marketing',
    items: [
      { label: 'Banners and home page', href: '/marketing/banners', permission: 'marketing:view' },
      { label: 'Coupons', href: '/marketing/coupons', permission: 'marketing:view' },
      { label: 'Trustlon Prime', href: '/marketing/prime', permission: 'marketing:view' },
      { label: 'SEO', href: '/marketing/seo', permission: 'marketing:view' },
      { label: 'Pages', href: '/marketing/pages', permission: 'marketing:view' },
    ],
  },
  {
    group: 'Trust and safety',
    items: [
      { label: 'Review moderation', href: '/trust/reviews', permission: 'trust:view' },
      { label: 'Reports', href: '/trust/reports', permission: 'trust:view' },
    ],
  },
  {
    group: 'Platform',
    items: [
      { label: 'Settings', href: '/settings', permission: 'settings:view' },
      { label: 'Staff', href: '/staff', permission: 'staff:view' },
      { label: 'Roles', href: '/staff/roles', permission: 'staff:view' },
      { label: 'Audit log', href: '/audit-log', permission: 'audit:view' },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === '/') return pathname === '/';
  if (href === '/vendors')
    return (
      pathname === '/vendors' ||
      (pathname.startsWith('/vendors/') && !pathname.startsWith('/vendors/kyc'))
    );
  if (href === '/staff') return pathname === '/staff';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can } = useAuth();
  return (
    <nav aria-label="Admin sections" className="space-y-5 px-3 py-4">
      {NAV.map((section) => {
        const items = section.items.filter((item) => can(item.permission));
        if (!items.length) return null;
        return (
          <div key={section.group || 'home'}>
            {section.group && (
              <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/50">
                {section.group}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-9 items-center rounded-lg px-3 text-sm transition',
                        'focus:outline-none focus-visible:ring-2 focus-visible:ring-logo-accent',
                        active
                          ? 'bg-white/15 font-semibold text-white'
                          : 'text-white/75 hover:bg-white/10 hover:text-white',
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Frame for every signed-in page: sidebar (drawer on phones), top bar and the page. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const { status, profile, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (status === 'guest')
      router.replace(
        `/login${pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : ''}`,
      );
  }, [status, pathname, router]);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [open]);

  if (status !== 'authenticated' || !profile) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-cream">
        <Loading label={status === 'guest' ? 'Redirecting to sign in…' : 'Loading…'} />
      </div>
    );
  }

  const storefront = process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

  return (
    <div className="min-h-dvh bg-cream lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:start-2 focus:top-2 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh overflow-y-auto bg-navy lg:block">
        <div className="flex h-14 items-center gap-2 border-b border-white/10 px-5">
          <BrandLogo inverted />
          <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">
            Admin
          </span>
        </div>
        <Sidebar />
      </aside>

      {/* Phone and tablet drawer */}
      {open && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
        >
          <button
            type="button"
            aria-label="Close menu"
            className="absolute inset-0 bg-navy/60"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 start-0 w-72 max-w-[85vw] overflow-y-auto bg-navy shadow-xl">
            <div className="flex h-14 items-center justify-between border-b border-white/10 px-4">
              <BrandLogo inverted />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-2xl text-white hover:bg-white/10"
              >
                ×
              </button>
            </div>
            <Sidebar onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-lg text-navy hover:bg-slate-100 lg:hidden',
                focusRing,
              )}
            >
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
              </svg>
            </button>
            <div className="lg:hidden">
              <BrandLogo />
            </div>
          </div>
          <div className="flex items-center gap-1 text-sm sm:gap-2">
            <a
              href={storefront}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'hidden rounded-lg px-2 py-1.5 text-teal-600 hover:underline sm:inline',
                focusRing,
              )}
            >
              View store
            </a>
            <Link
              href="/account"
              className={cn(
                'flex min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-100',
                focusRing,
              )}
            >
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-50 text-xs font-semibold text-navy"
              >
                {profile.user.fullName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')}
              </span>
              <span className="hidden min-w-0 text-start leading-tight md:block">
                <span className="block truncate font-medium text-navy">
                  {profile.user.fullName}
                </span>
                <span className="block text-xs text-slate-500">{humanize(profile.user.role)}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={() => void logout().then(() => router.replace('/login'))}
              className={cn('rounded-lg px-2 py-1.5 text-slate-600 hover:bg-slate-100', focusRing)}
            >
              Sign out
            </button>
          </div>
        </header>
        <main id="main" className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Shown in place of a page the signed-in role can't open, with links to what it can. */
export function Forbidden() {
  const { can } = useAuth();
  const allowed = NAV.flatMap((s) => s.items).filter((item) => can(item.permission));
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-8 text-center">
      <h1 className="text-lg font-semibold text-navy">This page isn’t part of your role</h1>
      <p className="mt-1 text-slate-600">Ask a Super Admin if you need access.</p>
      {allowed.length > 0 && (
        <ul className="mt-4 flex flex-wrap justify-center gap-2">
          {allowed.slice(0, 6).map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  'inline-flex h-9 items-center rounded-lg border border-slate-300 px-3 text-sm text-navy hover:bg-slate-50',
                  focusRing,
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Renders the page only when the role has the permission. */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: React.ReactNode;
}) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <Forbidden />;
}
