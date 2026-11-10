import { Tabs } from 'expo-router';
import { CompassIcon, MapIcon, ShoppingBagIcon, TicketIcon, UserIcon } from 'lucide-react-native';
import { HeaderRight } from '@/components/app/header-actions';
import { tabIcon } from '@/components/app/tab-icon';
import { THEME } from '@/lib/theme';
import { useThemeMode } from '@/lib/theme-pref';

export default function TouristTabs() {
  const colorScheme = useThemeMode((s) => s.mode);
  return (
    <Tabs screenOptions={{ headerRight: () => <HeaderRight cart />, tabBarActiveTintColor: THEME[colorScheme ?? 'light'].primary, headerShadowVisible: false }}>
      <Tabs.Screen name="index" options={{ title: 'Explore', tabBarIcon: tabIcon(CompassIcon) }} />
      <Tabs.Screen name="trips" options={{ title: 'My trips', tabBarLabel: 'Trips', tabBarIcon: tabIcon(MapIcon) }} />
      <Tabs.Screen name="market" options={{ title: 'Artisan market', tabBarLabel: 'Market', tabBarIcon: tabIcon(ShoppingBagIcon) }} />
      <Tabs.Screen name="activity" options={{ title: 'My bookings', tabBarLabel: 'Bookings', tabBarIcon: tabIcon(TicketIcon) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
