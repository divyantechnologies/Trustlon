import type { Metadata } from 'next';
import { PriceAlertsPage } from '@/features/account';

export const metadata: Metadata = { title: 'Price alerts' };

export default function Page() {
  return <PriceAlertsPage />;
}
