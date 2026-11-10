import * as React from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EyeIcon, EyeOffIcon, FlagIcon, StarIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Review } from '@/lib/types';

export default function Moderation() {
  const qc = useQueryClient();
  const [status, setStatus] = React.useState('reported');
  const q = useQuery({ queryKey: ['admin', 'reviews', status], queryFn: () => api.get<{ items: Review[] }>('/admin/reviews', { status }) });
  const set = useMutation({
    mutationFn: ({ id, to }: { id: number; to: 'visible' | 'hidden' }) => api.patch(`/admin/reviews/${id}`, { status: to }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(v.to === 'hidden' ? 'Review hidden' : 'Review restored', 'Trust scores were recalculated.');
    },
    onError: (e) => toast.error(e),
  });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ChipSelect options={[{ value: 'reported', label: 'Reported' }, { value: 'hidden', label: 'Hidden' }, { value: 'visible', label: 'Visible' }]} value={status} onChange={setStatus} />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((r) => (
            <View key={r.id} className="gap-2 rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Icon key={n} as={StarIcon} size={14} className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                  ))}
                </View>
                <View className="flex-row items-center gap-2">
                  <StatusBadge status={r.targetType} plain />
                  <Text variant="muted" className="text-xs">
                    {ago(r.createdAt)}
                  </Text>
                </View>
              </View>
              <Text>{r.comment ?? '(no comment)'}</Text>
              <Text variant="muted" className="text-xs">
                by {r.tourist?.fullName} ({r.tourist?.email})
              </Text>
              {r.reportReason ? (
                <View className="flex-row items-start gap-2 rounded-lg bg-orange-100 p-3 dark:bg-orange-900/30">
                  <Icon as={FlagIcon} className="mt-0.5 text-orange-600" />
                  <Text className="flex-1 text-sm">Reported: {r.reportReason}</Text>
                </View>
              ) : null}
              <View className="flex-row gap-2">
                {r.status !== 'visible' ? (
                  <Button variant="outline" className="flex-1" onPress={() => set.mutate({ id: r.id, to: 'visible' })}>
                    <Icon as={EyeIcon} />
                    <Text>Keep visible</Text>
                  </Button>
                ) : null}
                {r.status !== 'hidden' ? (
                  <Button variant="destructive" className="flex-1" onPress={() => set.mutate({ id: r.id, to: 'hidden' })}>
                    <Icon as={EyeOffIcon} className="text-white" />
                    <Text>Hide review</Text>
                  </Button>
                ) : null}
              </View>
            </View>
          ))
        ) : (
          <EmptyView icon={FlagIcon} title="Nothing to moderate" />
        )}
      </QueryState>
    </Screen>
  );
}
