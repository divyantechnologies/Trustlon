import type { NextConfig } from 'next';

const apiUrl = process.env.API_URL || 'http://localhost:4000';
// Built-in storefront text for Settings › Localisation comes from the storefront itself.
const storefrontUrl =
  process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_STOREFRONT_URL || 'http://localhost:3000';

/** Admin panel (admin.trustlon.com). The browser calls /api/v1 here and Next.js forwards it. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      { source: '/api/v1/:path*', destination: `${apiUrl}/api/v1/:path*` },
      { source: '/storefront-i18n', destination: `${storefrontUrl}/i18n` },
      { source: '/storefront-i18n/:lang', destination: `${storefrontUrl}/i18n/:lang` },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          // Never indexed, never framed by another site.
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};

export default nextConfig;
