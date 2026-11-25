import type { Metadata, Viewport } from 'next';
import { ToastProvider } from '@/components/ui';
import { defaultBrandColors } from '@/design-system/tokens';
import { AuthProvider } from '@/features/auth/auth-provider';
import { SiteConfigProvider } from '@/lib/site-config';
import { loadSiteConfig } from '@/lib/site-config.server';
import { fontsUrl, themeCss } from '@/lib/theme';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Trustlon Admin', template: '%s · Trustlon Admin' },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: defaultBrandColors.navy,
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Same brand colours, font and logo as the storefront (Settings › Theme).
  const config = await loadSiteConfig();
  return (
    <html lang="en-IN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link id="tl-theme-fonts" rel="stylesheet" href={fontsUrl(config.theme)} />
        <style id="tl-theme">{themeCss(config.theme)}</style>
      </head>
      <body>
        <SiteConfigProvider initial={config}>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
