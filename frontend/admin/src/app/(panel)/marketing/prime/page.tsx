import { RequirePermission } from '@/components/AppShell';
import { PrimePage } from '@/features/marketing/PrimePage';

export const metadata = { title: 'Trustlon Prime' };

export default function Page() {
  return (
    <RequirePermission permission="marketing:view">
      <PrimePage />
    </RequirePermission>
  );
}
