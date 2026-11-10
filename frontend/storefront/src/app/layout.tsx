import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/features/auth';
import { HomeProvider } from '@/features/home/home-provider';
import { LanguageProvider } from '@/lib/i18n/language-provider';
import { colors } from '@/design-system/tokens';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Trustlon', template: '%s | Trustlon' },
  description: 'Shop from Trustlon and verified sellers with escrow-protected payments.',
};

export const viewport: Viewport = { themeColor: colors.navy.DEFAULT };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Font availability must not block compilation of the root layout. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&family=Noto+Sans+Devanagari:wght@100..900&display=swap"
        />
      </head>
      <body>
        <LanguageProvider>
          <AuthProvider>
            <HomeProvider>{children}</HomeProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
