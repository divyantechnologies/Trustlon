import type { Metadata } from 'next';
import { AddressBook } from '@/features/account';

export const metadata: Metadata = { title: 'Saved addresses' };

export default function Page() {
  return <AddressBook />;
}
