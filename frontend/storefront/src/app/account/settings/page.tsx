import type { Metadata } from 'next';
import { SettingsPage } from '@/features/account';

export const metadata: Metadata = { title: 'Account settings' };

export default function Page() {
  return <SettingsPage />;
}
