import { RequirePermission } from '@/components/AppShell';
import { ProductDetailPage } from '@/features/catalog/ProductDetailPage';

export const metadata = { title: 'Product' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="products:view">
      <ProductDetailPage id={id} />
    </RequirePermission>
  );
}
