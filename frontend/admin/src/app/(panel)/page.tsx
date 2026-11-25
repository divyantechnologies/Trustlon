import { RequirePermission } from '@/components/AppShell';
import { Dashboard } from '@/features/dashboard/Dashboard';

export default function DashboardPage() {
  return (
    <RequirePermission permission="dashboard:view">
      <Dashboard />
    </RequirePermission>
  );
}
