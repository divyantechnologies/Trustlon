import { RequirePermission } from '@/components/AppShell';
import { KycQueue } from '@/features/vendors/KycQueue';

export const metadata = { title: 'KYC queue' };

export default function Page() {
  return (
    <RequirePermission permission="vendors:view">
      <KycQueue />
    </RequirePermission>
  );
}
