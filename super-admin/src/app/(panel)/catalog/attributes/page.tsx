import { RequirePermission } from '@/components/AppShell';
import { AttributesPage } from '@/features/catalog/AttributesPage';

export const metadata = { title: 'Attributes' };

export default function Page() {
  return (
    <RequirePermission permission="catalog:view">
      <AttributesPage />
    </RequirePermission>
  );
}
