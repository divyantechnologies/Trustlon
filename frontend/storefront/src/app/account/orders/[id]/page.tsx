import type { Metadata } from 'next';
import { OrderDetailPage } from '@/features/account';

export const metadata: Metadata = { title: 'Order details' };

export default function Page() {
  return <OrderDetailPage />;
}
