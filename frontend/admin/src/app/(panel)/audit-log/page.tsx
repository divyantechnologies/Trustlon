import { RequirePermission } from '@/components/AppShell';
import { AuditLogPage } from '@/features/staff/AuditLogPage';

export const metadata = { title: 'Audit log' };

export default function Page() {
  return (
    <RequirePermission permission="audit:view">
      <AuditLogPage />
    </RequirePermission>
  );
}
