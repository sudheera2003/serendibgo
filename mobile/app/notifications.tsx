import { Pressable, View } from 'react-native';
import { router, Stack } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellIcon, CheckCheckIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { ago } from '@/lib/format';
import type { Notification, Paged } from '@/lib/types';
import { cn } from '@/lib/utils';

/** Where tapping a notification should go, per role. */
function target(n: Notification, role: string) {
  if (!n.referenceType || !n.referenceId) return null;
  const id = n.referenceId;
  if (role === 'tourist') {
    if (n.referenceType === 'booking') return `/tourist/booking/${id}`;
    if (n.referenceType === 'order') return `/tourist/order/${id}`;
    if (n.referenceType === 'complaint') return '/tourist/complaints';
  }
  if (role === 'provider' && n.referenceType === 'booking') return `/provider/booking/${id}`;
  if (role === 'vendor' && n.referenceType === 'order') return '/vendor/orders';
  if (role === 'admin') {
    if (n.referenceType === 'provider' || n.referenceType === 'vendor') return '/admin/approvals';
    if (n.referenceType === 'review') return '/admin/moderation';
    if (n.referenceType === 'complaint') return '/admin/complaints';
  }
  if (n.type === 'review') return role === 'tourist' ? '/tourist/activity' : `/${role}/reviews`;
  return null;
}

export default function Notifications() {
  const qc = useQueryClient();
  const role = useAuth((s) => s.user?.role ?? 'tourist');
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.get<Paged<Notification> & { unread: number }>('/notifications', { limit: 50 }) });
  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
  const open = async (n: Notification) => {
    if (!n.isRead) {
      await api.patch(`/notifications/${n.id}/read`).catch(() => {});
      qc.invalidateQueries({ queryKey: ['notifications'] });
    }
    const to = target(n, role);
    if (to) router.push(to as never);
  };
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Stack.Screen
        options={{
          headerRight: () =>
            q.data?.unread ? (
              <Button variant="ghost" size="sm" onPress={() => readAll.mutate()}>
                <Icon as={CheckCheckIcon} />
                <Text>Read all</Text>
              </Button>
            ) : null,
        }}
      />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((n) => (
            <Pressable key={n.id} onPress={() => open(n)} className={cn('flex-row gap-3 rounded-xl border p-4', n.isRead ? 'border-border bg-card' : 'border-primary/30 bg-accent')}>
              <View className={cn('mt-1.5 h-2 w-2 rounded-full', n.isRead ? 'bg-transparent' : 'bg-primary')} />
              <View className="flex-1 gap-1">
                <Text className="font-semibold">{n.title}</Text>
                <Text variant="muted">{n.body}</Text>
                <Text variant="muted" className="text-xs">
                  {ago(n.createdAt)}
                </Text>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyView icon={BellIcon} title="No notifications yet" description="Booking, order and approval updates will appear here." />
        )}
      </QueryState>
    </Screen>
  );
}
