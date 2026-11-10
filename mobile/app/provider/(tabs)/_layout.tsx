import { Tabs } from 'expo-router';
import { useThemeMode } from '@/lib/theme-pref';
import { CalendarCheckIcon, LayoutDashboardIcon, ListIcon, StarIcon, UserIcon } from 'lucide-react-native';
import { HeaderRight } from '@/components/app/header-actions';
import { tabIcon } from '@/components/app/tab-icon';
import { THEME } from '@/lib/theme';

export default function ProviderTabs() {
  const colorScheme = useThemeMode((s) => s.mode);
  return (
    <Tabs screenOptions={{ headerRight: () => <HeaderRight />, tabBarActiveTintColor: THEME[colorScheme ?? 'light'].primary, headerShadowVisible: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon(LayoutDashboardIcon) }} />
      <Tabs.Screen name="listings" options={{ title: 'My listings', tabBarLabel: 'Listings', tabBarIcon: tabIcon(ListIcon) }} />
      <Tabs.Screen name="bookings" options={{ title: 'Bookings', tabBarIcon: tabIcon(CalendarCheckIcon) }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarIcon: tabIcon(StarIcon) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
