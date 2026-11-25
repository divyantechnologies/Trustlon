import { RequirePermission } from '@/components/AppShell';
import { HsnPage } from '@/features/catalog/HsnPage';

export const metadata = { title: 'HSN and GST' };

export default function Page() {
  return (
    <RequirePermission permission="catalog:view">
      <HsnPage />
    </RequirePermission>
  );
}
