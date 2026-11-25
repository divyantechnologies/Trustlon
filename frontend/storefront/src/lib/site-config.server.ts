import { DEFAULT_CONFIG, type SiteConfig } from './theme';

/** Server-side API address (same as the /api rewrite in next.config). */
const API_URL = process.env.API_URL ?? 'http://localhost:4000';
/** How long the server reuses settings before asking the API again. */
const REVALIDATE_SECONDS = 30;

async function getJson<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${API_URL}/api/v1${path}`, {
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(2000),
    });
    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    // API not running (e.g. during a build): use the built-in defaults.
    return null;
  }
}

export async function loadSiteConfig(): Promise<SiteConfig> {
  const config = await getJson<Partial<SiteConfig>>('/site/config');
  if (!config) return DEFAULT_CONFIG;
  return {
    ...DEFAULT_CONFIG,
    ...config,
    theme: {
      ...DEFAULT_CONFIG.theme,
      ...config.theme,
      colors: { ...DEFAULT_CONFIG.theme.colors, ...config.theme?.colors },
    },
    features: { ...DEFAULT_CONFIG.features, ...config.features },
  };
}

/** Edited English text, so the first paint shows it without a flash. */
export async function loadEnglishContent(): Promise<Record<string, string>> {
  const result = await getJson<{ entries: Record<string, string> }>('/site/content/en');
  return result?.entries ?? {};
}

/** Public address of the storefront, for sitemap.xml, robots.txt and canonical links. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export interface SeoView {
  title: string | null;
  description: string | null;
  keywords: string | null;
  ogImageUrl: string | null;
  noIndex: boolean;
}

/** Search title and description set in Admin › Marketing › SEO, or null. */
export async function loadSeo(
  entity: 'HOME' | 'CATEGORY' | 'PAGE',
  key: string,
): Promise<SeoView | null> {
  const result = await getJson<{ seo: SeoView | null }>(
    `/site/seo?entity=${entity}&key=${encodeURIComponent(key)}`,
  );
  return result?.seo ?? null;
}

/** Turns SEO settings into Next.js metadata. */
export function seoMetadata(
  seo: SeoView | null,
  fallback: { title?: string; description?: string } = {},
) {
  const title = seo?.title || fallback.title;
  const description = seo?.description || fallback.description;
  const image = seo?.ogImageUrl
    ? seo.ogImageUrl.startsWith('http')
      ? seo.ogImageUrl
      : `${SITE_URL}${seo.ogImageUrl}`
    : undefined;
  return {
    ...(title ? { title: seo?.title ? { absolute: seo.title } : title } : {}),
    ...(description ? { description } : {}),
    ...(seo?.keywords ? { keywords: seo.keywords } : {}),
    ...(seo?.noIndex ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      ...(title ? { title: seo?.title || title } : {}),
      ...(description ? { description } : {}),
      ...(image ? { images: [image] } : {}),
    },
  };
}

export interface CmsPageView {
  slug: string;
  title: string;
  body: string;
  updatedAt: string;
  seo: SeoView | null;
}

export async function loadCmsPage(slug: string): Promise<CmsPageView | null> {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  return getJson<CmsPageView>(`/site/pages/${slug}`);
}

export async function loadSitemap(): Promise<Array<{ path: string; updatedAt: string | null }>> {
  const result = await getJson<{ urls: Array<{ path: string; updatedAt: string | null }> }>(
    '/site/sitemap',
  );
  return result?.urls ?? [{ path: '/', updatedAt: null }];
}
