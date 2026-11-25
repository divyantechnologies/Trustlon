import { RequirePermission } from '@/components/AppShell';
import { CustomersList } from '@/features/customers/CustomersList';

export const metadata = { title: 'Customers' };

export default function Page() {
  return (
    <RequirePermission permission="customers:view">
      <CustomersList />
    </RequirePermission>
  );
}
