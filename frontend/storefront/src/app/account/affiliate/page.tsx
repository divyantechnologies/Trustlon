import type { Metadata } from 'next';
import { AffiliatePage } from '@/features/account';

export const metadata: Metadata = { title: 'Refer and earn' };

export default function Page() {
  return <AffiliatePage />;
}
