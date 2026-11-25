import type { Metadata } from 'next';
import { SupportList } from '@/features/account';

export const metadata: Metadata = { title: 'Help and support' };

export default function Page() {
  return <SupportList />;
}
