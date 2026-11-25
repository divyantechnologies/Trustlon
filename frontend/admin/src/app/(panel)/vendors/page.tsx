import { RequirePermission } from '@/components/AppShell';
import { VendorsList } from '@/features/vendors/VendorsList';

export const metadata = { title: 'Vendors' };

export default function Page() {
  return (
    <RequirePermission permission="vendors:view">
      <VendorsList />
    </RequirePermission>
  );
}
