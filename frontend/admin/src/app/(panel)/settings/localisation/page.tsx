import { RequirePermission } from '@/components/AppShell';
import { LocalisationPage } from '@/features/settings/LocalisationPage';

export const metadata = { title: 'Localisation' };

export default function Page() {
  return (
    <RequirePermission permission="settings:view">
      <LocalisationPage />
    </RequirePermission>
  );
}
