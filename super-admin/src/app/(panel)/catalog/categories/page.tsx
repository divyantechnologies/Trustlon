import { RequirePermission } from '@/components/AppShell';
import { CategoriesPage } from '@/features/catalog/CategoriesPage';

export const metadata = { title: 'Categories' };

export default function Page() {
  return (
    <RequirePermission permission="catalog:view">
      <CategoriesPage />
    </RequirePermission>
  );
}
