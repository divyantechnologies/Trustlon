import { RequirePermission } from '@/components/AppShell';
import { BannersPage } from '@/features/marketing/BannersPage';

export const metadata = { title: 'Banners and home page' };

export default function Page() {
  return (
    <RequirePermission permission="marketing:view">
      <BannersPage />
    </RequirePermission>
  );
}
