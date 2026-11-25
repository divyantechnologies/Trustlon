import { notFound } from 'next/navigation';
import { RequirePermission } from '@/components/AppShell';
import { BusinessRules } from '@/features/settings/BusinessRules';
import { FeaturesSettings } from '@/features/settings/FeaturesSettings';
import { NotificationSettings } from '@/features/settings/NotificationSettings';
import { PaymentsSettings } from '@/features/settings/PaymentsSettings';
import { RewardsSettings } from '@/features/settings/RewardsSettings';
import { ShippingSettings } from '@/features/settings/ShippingSettings';
import { TaxSettings } from '@/features/settings/TaxSettings';
import { ThemeSettings } from '@/features/settings/ThemeSettings';

const GROUPS: Record<string, { title: string; Component: () => React.ReactNode }> = {
  'business-rules': { title: 'Business rules', Component: BusinessRules },
  payments: { title: 'Payments', Component: PaymentsSettings },
  shipping: { title: 'Shipping', Component: ShippingSettings },
  tax: { title: 'Tax', Component: TaxSettings },
  notifications: { title: 'Notifications', Component: NotificationSettings },
  rewards: { title: 'Rewards', Component: RewardsSettings },
  features: { title: 'Features', Component: FeaturesSettings },
  theme: { title: 'Theme', Component: ThemeSettings },
};

export async function generateMetadata({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  return { title: GROUPS[group]?.title ?? 'Settings' };
}

export default async function Page({ params }: { params: Promise<{ group: string }> }) {
  const { group } = await params;
  const entry = GROUPS[group];
  if (!entry) notFound();
  const { Component } = entry;
  return (
    <RequirePermission permission="settings:view">
      <Component />
    </RequirePermission>
  );
}
