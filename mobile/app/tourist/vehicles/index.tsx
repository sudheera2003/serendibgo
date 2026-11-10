import * as React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { CarIcon } from 'lucide-react-native';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { VehicleCard } from '@/components/app/cards';
import { ChipSelect, DateField, Field } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { isoDay } from '@/lib/format';
import type { Paged, Vehicle } from '@/lib/types';

const TYPES = [
  { value: '', label: 'Any type' },
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
  { value: 'suv', label: 'SUV' },
  { value: 'tuk_tuk', label: 'Tuk-tuk' },
  { value: 'motorbike', label: 'Scooter' },
  { value: 'minibus', label: 'Minibus' },
];
const DRIVER = [
  { value: '', label: 'Driver or self-drive' },
  { value: 'true', label: 'With driver' },
  { value: 'false', label: 'Self-drive' },
];

export default function VehicleSearch() {
  const params = useLocalSearchParams<{ km?: string }>();
  const [from, setFrom] = React.useState<Date>(addDays(new Date(), 1));
  const [to, setTo] = React.useState<Date>(addDays(new Date(), 3));
  const [type, setType] = React.useState('');
  const [withDriver, setWithDriver] = React.useState('');
  const [location, setLocation] = React.useState('');
  const [km, setKm] = React.useState(params.km ?? '');

  const q = useQuery({
    queryKey: ['vehicles', isoDay(from), isoDay(to), type, withDriver, location, km],
    queryFn: () => api.get<Paged<Vehicle>>('/vehicles', { from: isoDay(from), to: isoDay(to), type: type || undefined, withDriver: withDriver || undefined, location: location || undefined, km: km || 0, limit: 30 }),
  });

  const params2 = { from: isoDay(from), to: isoDay(to), km: km || '0' };
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <DateField label="Pickup" value={from} onChange={(d) => { setFrom(d); if (to < d) setTo(d); }} minDate={new Date()} />
        </View>
        <View className="flex-1">
          <DateField label="Return" value={to} onChange={setTo} minDate={from} />
        </View>
      </View>
      <View className="flex-row gap-3">
        <Field label="Pickup town" className="flex-1">
          <Input value={location} onChangeText={setLocation} placeholder="e.g. Kandy" />
        </Field>
        <Field label="Planned km" className="w-28">
          <Input value={km} onChangeText={(t) => setKm(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="0" />
        </Field>
      </View>
      <ChipSelect options={TYPES} value={type} onChange={setType} />
      <ChipSelect options={DRIVER} value={withDriver} onChange={setWithDriver} />
      <Text variant="muted" className="text-xs">
        Only vehicles free for your dates are shown. Prices include rental, distance and driver fees – nothing hidden.
      </Text>
      <QueryState query={q}>
        {q.data?.items.length ? (
          <View className="gap-3">
            {q.data.items.map((v) => (
              <VehicleCard key={v.id} v={v} onPress={() => router.push({ pathname: `/tourist/vehicle/${v.id}`, params: params2 })} />
            ))}
          </View>
        ) : (
          <EmptyView icon={CarIcon} title="No vehicles available" description="Try other dates, a different type or leave the town empty." />
        )}
      </QueryState>
    </Screen>
  );
}
