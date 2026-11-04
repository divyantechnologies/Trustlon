import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { AuthProvider } from '@/features/auth';
import { LanguageProvider } from '@/lib/i18n/language-provider';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Trustlon', template: '%s | Trustlon' },
  description: 'Shop from Trustlon and verified sellers with escrow-protected payments.',
};

export const viewport: Viewport = { themeColor: '#13233f' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <LanguageProvider>
          <AuthProvider>{children}</AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
