import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { MessageSquareWarningIcon, PlusIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDate } from '@/lib/format';
import type { Complaint } from '@/lib/types';

export default function Complaints() {
  const q = useQuery({ queryKey: ['complaints', 'mine'], queryFn: () => api.get<{ items: Complaint[] }>('/complaints') });
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        <Button size="lg" onPress={() => router.push('/tourist/complaints/new')}>
          <Icon as={PlusIcon} />
          <Text>New complaint</Text>
        </Button>
      }>
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((c) => (
            <View key={c.id} className="gap-2 rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-semibold">{c.subject}</Text>
                <StatusBadge status={c.status} plain />
              </View>
              <Text variant="muted">{c.description}</Text>
              <Text variant="muted" className="text-xs">
                Submitted {fmtDate(c.createdAt)}
              </Text>
              {c.resolutionNote ? (
                <View className="rounded-lg bg-accent p-3">
                  <Text className="text-sm font-semibold">Response from SerendibGO</Text>
                  <Text className="text-sm">{c.resolutionNote}</Text>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyView icon={MessageSquareWarningIcon} title="No complaints" description="If something goes wrong with a booking, order or provider, let us know and an administrator will help." />
        )}
      </QueryState>
    </Screen>
  );
}
