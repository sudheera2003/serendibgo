import { router } from 'expo-router';
import { BriefcaseIcon } from 'lucide-react-native';
import { Screen } from '@/components/app/screen';
import { ListRow } from '@/components/app/bits';
import { ProfileScreen } from '@/components/app/profile-screen';
import { useAuth } from '@/lib/auth-store';

export default function ProviderProfile() {
  const p = useAuth((s) => s.user?.providerProfile);
  return (
    <Screen>
      <ProfileScreen extra={<ListRow icon={BriefcaseIcon} title={p?.businessName ?? 'Business details'} subtitle={p ? 'View or update your verified business details' : 'Submit your business for verification'} onPress={() => router.push('/provider/application')} />} />
    </Screen>
  );
}
