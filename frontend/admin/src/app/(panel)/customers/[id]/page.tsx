import { RequirePermission } from '@/components/AppShell';
import { CustomerDetailPage } from '@/features/customers/CustomerDetailPage';

export const metadata = { title: 'Customer' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="customers:view">
      <CustomerDetailPage id={id} />
    </RequirePermission>
  );
}
