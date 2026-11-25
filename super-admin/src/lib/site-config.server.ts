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
