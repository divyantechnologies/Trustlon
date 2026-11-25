import { RequirePermission } from '@/components/AppShell';
import { CouponsPage } from '@/features/marketing/CouponsPage';

export const metadata = { title: 'Coupons' };

export default function Page() {
  return (
    <RequirePermission permission="marketing:view">
      <CouponsPage />
    </RequirePermission>
  );
}
