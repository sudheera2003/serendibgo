import { Tabs } from 'expo-router';
import { useThemeMode } from '@/lib/theme-pref';
import { useQuery } from '@tanstack/react-query';
import { ChartColumnIcon, EllipsisIcon, FlagIcon, MessageSquareWarningIcon, ShieldCheckIcon } from 'lucide-react-native';
import { HeaderRight } from '@/components/app/header-actions';
import { tabIcon } from '@/components/app/tab-icon';
import { api } from '@/lib/api';
import { THEME } from '@/lib/theme';

interface Analytics {
  pendingApplications: number;
  reportedReviews: number;
  openComplaints: number;
}

export default function AdminTabs() {
  const colorScheme = useThemeMode((s) => s.mode);
  const a = useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => api.get<Analytics>('/admin/analytics'), refetchInterval: 60_000 });
  const badge = (n?: number) => (n ? n : undefined);
  return (
    <Tabs screenOptions={{ headerRight: () => <HeaderRight />, tabBarActiveTintColor: THEME[colorScheme ?? 'light'].primary, headerShadowVisible: false }}>
      <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarIcon: tabIcon(ChartColumnIcon) }} />
      <Tabs.Screen name="approvals" options={{ title: 'Verification queue', tabBarLabel: 'Approvals', tabBarIcon: tabIcon(ShieldCheckIcon), tabBarBadge: badge(a.data?.pendingApplications) }} />
      <Tabs.Screen name="moderation" options={{ title: 'Review moderation', tabBarLabel: 'Moderation', tabBarIcon: tabIcon(FlagIcon), tabBarBadge: badge(a.data?.reportedReviews) }} />
      <Tabs.Screen name="complaints" options={{ title: 'Complaints', tabBarIcon: tabIcon(MessageSquareWarningIcon), tabBarBadge: badge(a.data?.openComplaints) }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: tabIcon(EllipsisIcon) }} />
    </Tabs>
  );
}
