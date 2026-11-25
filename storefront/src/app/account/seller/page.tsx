import type { Metadata } from 'next';
import { SellerDeliveryPage } from '@/features/local/SellerDeliveryPage';

export const metadata: Metadata = { title: 'Seller delivery settings' };
export default function Page() {
  return <SellerDeliveryPage />;
}
