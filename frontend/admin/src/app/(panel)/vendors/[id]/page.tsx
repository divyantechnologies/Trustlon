import { RequirePermission } from '@/components/AppShell';
import { VendorDetailPage } from '@/features/vendors/VendorDetailPage';

export const metadata = { title: 'Vendor' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="vendors:view">
      <VendorDetailPage id={id} />
    </RequirePermission>
  );
}
