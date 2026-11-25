import { RequirePermission } from '@/components/AppShell';
import { StaffPage } from '@/features/staff/StaffPage';

export const metadata = { title: 'Staff' };

export default function Page() {
  return (
    <RequirePermission permission="staff:view">
      <StaffPage />
    </RequirePermission>
  );
}
