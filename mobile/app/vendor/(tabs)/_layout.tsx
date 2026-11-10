import { Tabs } from 'expo-router';
import { useThemeMode } from '@/lib/theme-pref';
import { BoxesIcon, LayoutDashboardIcon, PackageCheckIcon, StarIcon, UserIcon } from 'lucide-react-native';
import { HeaderRight } from '@/components/app/header-actions';
import { tabIcon } from '@/components/app/tab-icon';
import { THEME } from '@/lib/theme';

export default function VendorTabs() {
  const colorScheme = useThemeMode((s) => s.mode);
  return (
    <Tabs screenOptions={{ headerRight: () => <HeaderRight />, tabBarActiveTintColor: THEME[colorScheme ?? 'light'].primary, headerShadowVisible: false }}>
      <Tabs.Screen name="index" options={{ title: 'My shop', tabBarLabel: 'Shop', tabBarIcon: tabIcon(LayoutDashboardIcon) }} />
      <Tabs.Screen name="products" options={{ title: 'Products', tabBarIcon: tabIcon(BoxesIcon) }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders to fulfil', tabBarLabel: 'Orders', tabBarIcon: tabIcon(PackageCheckIcon) }} />
      <Tabs.Screen name="reviews" options={{ title: 'Reviews', tabBarIcon: tabIcon(StarIcon) }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: tabIcon(UserIcon) }} />
    </Tabs>
  );
}
