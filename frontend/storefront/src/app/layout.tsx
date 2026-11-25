import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/features/auth';
import { HomeProvider } from '@/features/home/home-provider';
import { LanguageProvider } from '@/lib/i18n/language-provider';
import { SiteConfigProvider } from '@/lib/site-config';
import { loadEnglishContent, loadSiteConfig } from '@/lib/site-config.server';
import { fontsUrl, themeCss } from '@/lib/theme';
import { defaultBrandColors } from '@/design-system/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Trustlon', template: '%s | Trustlon' },
  description: 'Shop from Trustlon and verified sellers with escrow-protected payments.',
};

export const viewport: Viewport = {
  themeColor: defaultBrandColors.navy,
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme, switches and edited text from the admin panel. Falls back to the defaults if the API is down.
  const [config, englishContent] = await Promise.all([loadSiteConfig(), loadEnglishContent()]);

  return (
    <html lang="en">
      <head>
        {/* Font availability must not block compilation of the root layout. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link id="tl-theme-fonts" rel="stylesheet" href={fontsUrl(config.theme)} />
        <style id="tl-theme">{themeCss(config.theme)}</style>
      </head>
      <body>
        <SiteConfigProvider initial={config}>
          <LanguageProvider
            initialOverrides={englishContent}
            contentVersion={config.contentVersion}
          >
            <AuthProvider>
              <HomeProvider>{children}</HomeProvider>
            </AuthProvider>
          </LanguageProvider>
        </SiteConfigProvider>
      </body>
    </html>
  );
}
