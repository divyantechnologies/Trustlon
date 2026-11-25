import { NextResponse, type NextRequest } from 'next/server';

/**
 * Redirects set in Admin › Marketing › SEO (e.g. an old category address to the new one).
 * The list is cached for a minute; if the API is down, requests pass straight through.
 */
const API_URL = process.env.API_URL || 'http://localhost:4000';
const TTL_MS = 60_000;

type Redirects = Record<string, { to: string; permanent: boolean }>;
let cache: { at: number; redirects: Redirects } | null = null;
let pending: Promise<Redirects> | null = null;

async function redirects(): Promise<Redirects> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.redirects;
  pending ??= fetch(`${API_URL}/api/v1/site/redirects`, { signal: AbortSignal.timeout(1500) })
    .then((response) => (response.ok ? response.json() : { redirects: cache?.redirects ?? {} }))
    .then((body: { redirects?: Redirects }) => {
      cache = { at: Date.now(), redirects: body.redirects ?? {} };
      return cache.redirects;
    })
    .catch(() => cache?.redirects ?? {})
    .finally(() => {
      pending = null;
    });
  return pending;
}

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const list = await redirects();
  const hit =
    list[path] ?? (path.length > 1 && path.endsWith('/') ? list[path.slice(0, -1)] : undefined);
  if (!hit || hit.to === path) return NextResponse.next();
  const target = hit.to.startsWith('https://') ? new URL(hit.to) : new URL(hit.to, request.url);
  return NextResponse.redirect(target, hit.permanent ? 308 : 307);
}

export const config = {
  // Pages only: not Next.js files, the API proxy, images or other files with an extension.
  matcher: ['/((?!_next/|api/|i18n|favicon.ico|sitemap.xml|robots.txt|.*\\.[a-zA-Z0-9]+$).*)'],
};
