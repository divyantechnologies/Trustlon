import type { Metadata } from 'next';
import { ReturnsList } from '@/features/account';

export const metadata: Metadata = { title: 'Returns and refunds' };

export default function Page() {
  return <ReturnsList />;
}
