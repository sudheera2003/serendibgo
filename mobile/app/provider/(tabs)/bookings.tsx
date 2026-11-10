import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarCheckIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtDate, lkrText } from '@/lib/format';
import type { Booking, Paged } from '@/lib/types';

const FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'accepted', label: 'Awaiting payment' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'declined', label: 'Declined' },
];

export default function ProviderBookings() {
  const hasProfile = useAuth((s) => !!s.user?.providerProfile);
  const [status, setStatus] = React.useState('');
  const q = useQuery({ queryKey: ['provider-bookings', status], queryFn: () => api.get<Paged<Booking>>('/bookings/incoming', { status: status || undefined, limit: 50 }), enabled: hasProfile });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ChipSelect options={FILTERS} value={status} onChange={setStatus} />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((b) => (
            <Pressable key={b.id} onPress={() => router.push(`/provider/booking/${b.id}`)} className="gap-1 rounded-2xl border border-border bg-card p-4 active:bg-accent">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-semibold">{b.package?.title ?? b.vehicle?.makeModel}</Text>
                <StatusBadge status={b.status} plain />
              </View>
              <Text variant="muted" className="text-sm">
                #{b.id} · {b.tourist.fullName} · {fmtDate(b.startDate)}
                {b.bookingType === 'vehicle' ? ` → ${fmtDate(b.endDate)}` : ` · ${b.numPersons} people`}
              </Text>
              <Text className="font-semibold">{lkrText(b.totalAmount)}</Text>
            </Pressable>
          ))
        ) : (
          <EmptyView icon={CalendarCheckIcon} title="No bookings here" />
        )}
      </QueryState>
    </Screen>
  );
}
