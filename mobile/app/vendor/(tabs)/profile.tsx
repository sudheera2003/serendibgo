import { router } from 'expo-router';
import { StoreIcon } from 'lucide-react-native';
import { Screen } from '@/components/app/screen';
import { ListRow } from '@/components/app/bits';
import { ProfileScreen } from '@/components/app/profile-screen';
import { useAuth } from '@/lib/auth-store';

export default function VendorProfile() {
  const shop = useAuth((s) => s.user?.vendorProfile);
  return (
    <Screen>
      <ProfileScreen extra={<ListRow icon={StoreIcon} title={shop?.shopName ?? 'Shop details'} subtitle={shop ? 'View or update your shop details' : 'Submit your shop for verification'} onPress={() => router.push('/vendor/application')} />} />
    </Screen>
  );
}
