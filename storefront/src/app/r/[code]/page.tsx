'use client';
import { useParams, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { accountApi } from '@/features/account/api';

/** Strict mode runs effects twice in development; count each link once per page load. */
const tracked = new Set<string>();

/** Shared product link (spec 3.9): counts the click, remembers it for checkout, then opens the product. */
export default function AffiliateRedirect() {
  const { code } = useParams<{ code: string }>();
  const router = useRouter();

  useEffect(() => {
    let active = true;
    if (tracked.has(code)) return;
    tracked.add(code);
    accountApi
      .trackAffiliateClick(code)
      .then((result) => {
        try {
          window.localStorage.setItem(
            'tl_aff',
            JSON.stringify({ code: result.code, at: Date.now() }),
          );
        } catch {
          // Private browsing: the product still opens, the sale just is not attributed.
        }
        if (active) router.replace(`/c/${encodeURIComponent(result.product.categorySlug)}`);
      })
      .catch(() => active && router.replace('/'));
    return () => {
      active = false;
    };
  }, [code, router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6">
      <p className="text-slate-500" role="status">
        Opening the product…
      </p>
    </main>
  );
}
