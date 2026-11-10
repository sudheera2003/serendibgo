import { View } from 'react-native';
import { router } from 'expo-router';
import { HistoryIcon, LayersIcon, MapPinnedIcon, ReceiptTextIcon, UsersIcon } from 'lucide-react-native';
import { Screen } from '@/components/app/screen';
import { ListRow, Section } from '@/components/app/bits';
import { ProfileScreen } from '@/components/app/profile-screen';

export default function AdminMore() {
  return (
    <Screen>
      <Section title="Platform management">
        <View className="gap-2">
          <ListRow icon={MapPinnedIcon} title="Destinations" subtitle="Add and edit places of interest" onPress={() => router.push('/admin/destinations')} />
          <ListRow icon={LayersIcon} title="Product categories" subtitle="Marketplace categories" onPress={() => router.push('/admin/categories')} />
          <ListRow icon={UsersIcon} title="Users" subtitle="Search, suspend or reactivate accounts" onPress={() => router.push('/admin/users')} />
          <ListRow icon={ReceiptTextIcon} title="Bookings & orders" subtitle="Monitor platform activity" onPress={() => router.push('/admin/monitor')} />
          <ListRow icon={HistoryIcon} title="Audit log" subtitle="Every administrative action" onPress={() => router.push('/admin/audit-logs')} />
        </View>
      </Section>
      <Section title="My account">
        <ProfileScreen />
      </Section>
    </Screen>
  );
}
