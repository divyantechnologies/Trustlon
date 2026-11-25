import { RequirePermission } from '@/components/AppShell';
import { SeoPage } from '@/features/marketing/SeoPage';

export const metadata = { title: 'SEO' };

export default function Page() {
  return (
    <RequirePermission permission="marketing:view">
      <SeoPage />
    </RequirePermission>
  );
}
