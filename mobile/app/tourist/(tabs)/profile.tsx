import { View } from 'react-native';
import { router } from 'expo-router';
import { MessageSquareWarningIcon, ReceiptIcon } from 'lucide-react-native';
import { Screen } from '@/components/app/screen';
import { ListRow } from '@/components/app/bits';
import { ProfileScreen } from '@/components/app/profile-screen';

export default function TouristProfile() {
  return (
    <Screen>
      <ProfileScreen
        extra={
          <View className="gap-2">
            <ListRow icon={ReceiptIcon} title="Payments & receipts" subtitle="Everything you have paid for" onPress={() => router.push('/tourist/payments')} />
            <ListRow icon={MessageSquareWarningIcon} title="Complaints" subtitle="Report a problem and track the response" onPress={() => router.push('/tourist/complaints')} />
          </View>
        }
      />
    </Screen>
  );
}
