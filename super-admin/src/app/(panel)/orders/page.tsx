import { RequirePermission } from '@/components/AppShell';
import { OrdersList } from '@/features/orders/OrdersList';

export const metadata = { title: 'Orders' };

export default function Page() {
  return (
    <RequirePermission permission="orders:view">
      <OrdersList />
    </RequirePermission>
  );
}
