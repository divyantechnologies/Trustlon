import { RequirePermission } from '@/components/AppShell';
import { OrderDetailPage } from '@/features/orders/OrderDetailPage';

export const metadata = { title: 'Order' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="orders:view">
      <OrderDetailPage id={id} />
    </RequirePermission>
  );
}
