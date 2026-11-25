import { RequirePermission } from '@/components/AppShell';
import { ProductsPage } from '@/features/catalog/ProductsPage';

export const metadata = { title: 'Products' };

export default function Page() {
  return (
    <RequirePermission permission="products:view">
      <ProductsPage />
    </RequirePermission>
  );
}
