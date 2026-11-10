import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MapIcon, PlusIcon, RouteIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { duration, fmtDate, useMoney } from '@/lib/format';
import type { Trip } from '@/lib/types';

export default function Trips() {
  const money = useMoney();
  const q = useQuery({ queryKey: ['trips'], queryFn: () => api.get<{ items: Trip[] }>('/trips') });
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        <Button size="lg" onPress={() => router.push('/tourist/trip/new')}>
          <Icon as={PlusIcon} />
          <Text>Plan a new trip</Text>
        </Button>
      }>
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((t) => (
            <Pressable key={t.id} onPress={() => router.push(`/tourist/trip/${t.id}`)} className="gap-2 rounded-2xl border border-border bg-card p-4 active:bg-accent">
              <View className="flex-row items-center justify-between">
                <Text className="text-lg font-bold">{t.title}</Text>
                <Icon as={RouteIcon} className="text-primary" />
              </View>
              <Text variant="muted" className="text-sm" numberOfLines={2}>
                {t.stops.length ? t.stops.map((s) => s.destination.name).join(' → ') : 'No stops yet'}
              </Text>
              <View className="flex-row flex-wrap gap-x-4 gap-y-1">
                <Text className="text-sm">{t.stops.length} stops</Text>
                <Text className="text-sm">{Number(t.totalDistanceKm).toFixed(0)} km</Text>
                <Text className="text-sm">{duration(t.totalDurationMin)} driving</Text>
                <Text className="text-sm font-semibold text-primary">{money(t.estimatedCost).split(' (')[0]}</Text>
              </View>
              {t.startDate ? (
                <Text variant="muted" className="text-xs">
                  {fmtDate(t.startDate)} – {fmtDate(t.endDate)}
                </Text>
              ) : null}
            </Pressable>
          ))
        ) : (
          <EmptyView icon={MapIcon} title="No trips yet" description="Plan a multi-stop journey and we will calculate distances, travel times and costs for you." />
        )}
      </QueryState>
    </Screen>
  );
}
