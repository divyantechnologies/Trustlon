import { RequirePermission } from '@/components/AppShell';
import { PagesList } from '@/features/marketing/PagesList';

export const metadata = { title: 'Pages' };

export default function Page() {
  return (
    <RequirePermission permission="marketing:view">
      <PagesList />
    </RequirePermission>
  );
}
