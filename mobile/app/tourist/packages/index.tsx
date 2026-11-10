import * as React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { GitCompareIcon, SearchXIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { PackageCard } from '@/components/app/cards';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Paged, TourPackage } from '@/lib/types';

const SORTS = [
  { value: 'rating', label: 'Trust score' },
  { value: 'price_asc', label: 'Lowest price' },
  { value: 'price_desc', label: 'Highest price' },
  { value: 'duration', label: 'Shortest' },
];
const DAYS = [
  { value: 0, label: 'Any length' },
  { value: 1, label: '1 day' },
  { value: 2, label: '2 days' },
  { value: 3, label: '3+ days' },
];

export default function Packages() {
  const params = useLocalSearchParams<{ q?: string }>();
  const [q, setQ] = React.useState(params.q ?? '');
  const [debounced, setDebounced] = React.useState(params.q ?? '');
  const [sort, setSort] = React.useState('rating');
  const [days, setDays] = React.useState(0);
  const [compare, setCompare] = React.useState<number[]>([]);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const query = useQuery({
    queryKey: ['packages', debounced, sort, days],
    queryFn: () =>
      api.get<Paged<TourPackage>>('/packages', {
        q: debounced,
        sort,
        minDays: days === 3 ? 3 : days || undefined,
        maxDays: days && days < 3 ? days : undefined,
        limit: 30,
      }),
  });

  const toggle = (id: number) =>
    setCompare((c) => {
      if (c.includes(id)) return c.filter((x) => x !== id);
      if (c.length >= 3) {
        toast.info('Up to 3 packages', 'Remove one to add another.');
        return c;
      }
      return [...c, id];
    });

  return (
    <Screen
      refreshing={query.isRefetching}
      onRefresh={query.refetch}
      footer={
        compare.length >= 2 ? (
          <Button size="lg" onPress={() => router.push({ pathname: '/tourist/packages/compare', params: { ids: compare.join(',') } })}>
            <Icon as={GitCompareIcon} />
            <Text>Compare {compare.length} packages</Text>
          </Button>
        ) : compare.length === 1 ? (
          <Text variant="muted" className="text-center">
            Select one more package to compare
          </Text>
        ) : undefined
      }>
      <Input value={q} onChangeText={setQ} placeholder="Search by place or activity" />
      <ChipSelect options={SORTS} value={sort} onChange={setSort} />
      <ChipSelect options={DAYS} value={days} onChange={setDays} />
      <Text variant="muted" className="text-xs">
        Tick "Compare" on 2–3 packages to see prices and inclusions side by side.
      </Text>
      <QueryState query={query}>
        {query.data?.items.length ? (
          <View className="gap-3">
            {query.data.items.map((p) => (
              <PackageCard key={p.id} p={p} selectable selected={compare.includes(p.id)} onToggle={() => toggle(p.id)} />
            ))}
          </View>
        ) : (
          <EmptyView icon={SearchXIcon} title="No packages match" description="Try a different search or filter." />
        )}
      </QueryState>
    </Screen>
  );
}
