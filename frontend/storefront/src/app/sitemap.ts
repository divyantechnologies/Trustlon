import type { MetadataRoute } from 'next';
import { loadSitemap, SITE_URL } from '@/lib/site-config.server';

export const revalidate = 600;

/** sitemap.xml from live categories, products, stores and pages (pages hidden in SEO are left out). */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const urls = await loadSitemap();
  return urls.map((url) => ({
    url: `${SITE_URL}${url.path}`,
    ...(url.updatedAt ? { lastModified: new Date(url.updatedAt) } : {}),
  }));
}
