import { RequirePermission } from '@/components/AppShell';
import { ReportsPage } from '@/features/trust/ReportsPage';

export const metadata = { title: 'Reports' };

export default function Page() {
  return (
    <RequirePermission permission="trust:view">
      <ReportsPage />
    </RequirePermission>
  );
}
