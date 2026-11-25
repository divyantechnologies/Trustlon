import type { Metadata } from 'next';
import { BusinessPage } from '@/features/account';

export const metadata: Metadata = { title: 'Business buying' };

export default function Page() {
  return <BusinessPage />;
}
