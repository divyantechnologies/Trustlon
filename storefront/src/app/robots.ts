import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-config.server';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/account', '/api/', '/r/', '/i18n'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
