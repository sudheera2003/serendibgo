import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CheckIcon, XIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { lkrText } from '@/lib/format';
import type { TourPackage } from '@/lib/types';
import { cn } from '@/lib/utils';

interface Data {
  packages: TourPackage[];
  rows: { label: string; values: (number | boolean)[] }[];
}

const COL = 150;
const LABEL = 140;

/** FR08 – side-by-side comparison of 2–3 packages; differences are highlighted. */
export default function Compare() {
  const { ids } = useLocalSearchParams<{ ids: string }>();
  const q = useQuery({ queryKey: ['compare', ids], queryFn: () => api.get<Data>('/packages/compare', { ids }) });

  const best = (label: string, values: (number | boolean)[]) => {
    const nums = values.filter((v): v is number => typeof v === 'number');
    if (nums.length !== values.length) return -1;
    if (label.startsWith('Price')) return values.indexOf(Math.min(...nums));
    if (label === 'Trust score' || label === 'Reviews' || label === 'Destinations' || label === 'Max group size') return values.indexOf(Math.max(...nums));
    return -1;
  };

  const show = (label: string, v: number | boolean) => {
    if (typeof v === 'boolean') return <Icon as={v ? CheckIcon : XIcon} size={18} className={v ? 'text-primary' : 'text-muted-foreground/50'} />;
    if (label.startsWith('Price')) return <Text className="text-center font-semibold">{lkrText(v)}</Text>;
    if (label === 'Trust score') return <Text className="text-center font-semibold">{v ? `★ ${Number(v).toFixed(1)}` : '—'}</Text>;
    return <Text className="text-center">{v}</Text>;
  };

  return (
    <Screen>
      <QueryState query={q}>
        {q.data ? (
          <ScrollView horizontal showsHorizontalScrollIndicator>
            <View className="overflow-hidden rounded-xl border border-border">
              <View className="flex-row bg-muted">
                <View style={{ width: LABEL }} className="p-3" />
                {q.data.packages.map((p) => (
                  <View key={p.id} style={{ width: COL }} className="gap-2 border-l border-border p-3">
                    <Text className="font-bold" numberOfLines={3}>
                      {p.title}
                    </Text>
                    <Text variant="muted" className="text-xs" numberOfLines={1}>
                      {p.provider.businessName}
                    </Text>
                    <Button size="sm" onPress={() => router.push(`/tourist/package/${p.id}`)}>
                      <Text>View</Text>
                    </Button>
                  </View>
                ))}
              </View>
              {q.data.rows.map((row, ri) => {
                const b = best(row.label, row.values);
                return (
                  <View key={row.label} className={cn('flex-row', ri % 2 ? 'bg-card' : 'bg-background')}>
                    <View style={{ width: LABEL }} className="justify-center p-3">
                      <Text className="text-sm font-medium">{row.label}</Text>
                    </View>
                    {row.values.map((v, i) => (
                      <View key={i} style={{ width: COL }} className={cn('items-center justify-center border-l border-border p-3', i === b && 'bg-accent')}>
                        {show(row.label, v)}
                      </View>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </QueryState>
      <Text variant="muted" className="text-xs">
        Highlighted cells show the best value in each row. All prices include every listed inclusion – there are no hidden fees.
      </Text>
    </Screen>
  );
}
