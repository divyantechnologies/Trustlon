import { RequirePermission } from '@/components/AppShell';
import { PageEditor } from '@/features/marketing/PageEditor';

export const metadata = { title: 'Page' };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <RequirePermission permission="marketing:view">
      <PageEditor id={id === 'new' ? 'new' : id} />
    </RequirePermission>
  );
}
