import type { Metadata } from 'next';
import { SellPage } from '@/features/sell';

export const metadata: Metadata = {
  title: 'Sell on Trustlon',
  description:
    'Sell to customers across India with low commission, escrow-protected payouts, your own Brand Store and built-in GST tools.',
};

export default function Page() {
  return <SellPage />;
}
