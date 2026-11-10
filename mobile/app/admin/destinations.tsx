import * as React from 'react';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { PlusIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { ListRow, StatusBadge } from '@/components/app/bits';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { titleCase } from '@/lib/format';
import type { Destination } from '@/lib/types';

export default function AdminDestinations() {
  const [q, setQ] = React.useState('');
  const query = useQuery({ queryKey: ['admin', 'destinations'], queryFn: () => api.get<{ items: Destination[] }>('/admin/destinations') });
  const items = (query.data?.items ?? []).filter((d) => `${d.name} ${d.district}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={query.refetch}
      footer={
        <Button size="lg" onPress={() => router.push('/admin/destination-editor')}>
          <Icon as={PlusIcon} />
          <Text>Add destination</Text>
        </Button>
      }>
      <Input value={q} onChangeText={setQ} placeholder="Filter destinations" />
      <QueryState query={query}>
        {items.map((d) => (
          <ListRow
            key={d.id}
            title={d.name}
            subtitle={`${d.district}, ${d.province} · ${titleCase(d.category)}`}
            right={d.isActive ? undefined : <StatusBadge status="hidden" plain />}
            onPress={() => router.push({ pathname: '/admin/destination-editor', params: { id: String(d.id) } })}
          />
        ))}
      </QueryState>
    </Screen>
  );
}
