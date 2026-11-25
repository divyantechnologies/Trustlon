import { RequirePermission } from '@/components/AppShell';
import { RolesPage } from '@/features/staff/RolesPage';

export const metadata = { title: 'Roles' };

export default function Page() {
  return (
    <RequirePermission permission="staff:view">
      <RolesPage />
    </RequirePermission>
  );
}
