import { RequirePermission } from '@/components/AppShell';
import { SettingsIndex } from '@/features/settings/SettingsIndex';

export const metadata = { title: 'Settings' };

export default function Page() {
  return (
    <RequirePermission permission="settings:view">
      <SettingsIndex />
    </RequirePermission>
  );
}
