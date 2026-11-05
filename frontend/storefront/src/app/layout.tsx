import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Devanagari } from 'next/font/google';
import { HomeProvider } from '@/features/home/home-provider';
import { LanguageProvider } from '@/lib/i18n/language-provider';
import { colors } from '@/design-system/tokens';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

const hindi = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  variable: '--font-hindi',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Trustlon', template: '%s | Trustlon' },
  description: 'Shop from Trustlon and verified sellers with escrow-protected payments.',
};

export const viewport: Viewport = { themeColor: colors.navy.DEFAULT };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${hindi.variable}`}>
      <body>
        <LanguageProvider>
          <HomeProvider>{children}</HomeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
