import type { Metadata } from 'next';
import { WalletPage } from '@/features/account';

export const metadata: Metadata = { title: 'Wallet and Trustlon Coins' };

export default function Page() {
  return <WalletPage />;
}
