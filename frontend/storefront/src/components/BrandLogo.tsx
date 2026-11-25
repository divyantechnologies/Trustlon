'use client';

import Link from 'next/link';
import { useSiteConfig } from '@/lib/site-config';

/** Logo from Admin › Settings › Theme: the uploaded image, or the shield mark with the brand name. */
export function BrandLogo({ inverted = false }: { inverted?: boolean }) {
  const { theme } = useSiteConfig().config;
  if (theme.logoUrl) {
    return (
      <Link href="/" className="inline-flex items-center" aria-label={`${theme.logoText} home`}>
        <img
          src={theme.logoUrl}
          alt={theme.logoText}
          className={`h-8 w-auto max-w-[180px] object-contain ${inverted ? 'rounded-md bg-white px-1.5' : ''}`}
        />
      </Link>
    );
  }
  return (
    <Link href="/" className="inline-flex items-center gap-2" aria-label={`${theme.logoText} home`}>
      <span
        aria-hidden
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${inverted ? 'bg-white/10' : 'bg-navy'}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 text-logo-accent"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        >
          <path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.4 7.5 9.5 4.4-1.1 7.5-4.9 7.5-9.5V6L12 3Z" />
          <path d="m8.8 12.2 2.2 2.2 4.3-4.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className={`text-lg font-bold tracking-tight ${inverted ? 'text-white' : 'text-navy'}`}>
        {theme.logoText}
      </span>
    </Link>
  );
}
