import { RequirePermission } from '@/components/AppShell';
import { ReviewModeration } from '@/features/trust/ReviewModeration';

export const metadata = { title: 'Review moderation' };

export default function Page() {
  return (
    <RequirePermission permission="trust:view">
      <ReviewModeration />
    </RequirePermission>
  );
}
