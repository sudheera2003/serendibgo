import * as React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDate, lkrText } from '@/lib/format';
import type { Paged } from '@/lib/types';

interface BookingRow {
  id: number;
  status: string;
  startDate: string;
  totalAmount: number;
  tourist: { fullName: string };
  package: { title: string } | null;
  vehicle: { makeModel: string } | null;
}
interface OrderRow {
  id: number;
  status: string;
  totalAmount: number;
  createdAt: string;
  deliveryType: string;
  tourist: { fullName: string };
  _count: { items: number };
}

export default function Monitor() {
  const [tab, setTab] = React.useState('bookings');
  const bookings = useQuery({ queryKey: ['admin', 'bookings'], queryFn: () => api.get<Paged<BookingRow>>('/admin/bookings', { limit: 50 }) });
  const orders = useQuery({ queryKey: ['admin', 'orders'], queryFn: () => api.get<Paged<OrderRow>>('/admin/orders', { limit: 50 }) });
  const active = tab === 'bookings' ? bookings : orders;
  return (
    <Screen refreshing={active.isRefetching} onRefresh={active.refetch}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-row">
          <TabsTrigger value="bookings" className="flex-1">
            <Text>Bookings ({bookings.data?.total ?? '…'})</Text>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1">
            <Text>Orders ({orders.data?.total ?? '…'})</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState query={active}>
        {tab === 'bookings'
          ? bookings.data?.items.map((b) => (
              <View key={b.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
                <View className="flex-1">
                  <Text className="font-semibold">#{b.id} · {b.package?.title ?? b.vehicle?.makeModel}</Text>
                  <Text variant="muted" className="text-xs">
                    {b.tourist.fullName} · {fmtDate(b.startDate)} · {lkrText(b.totalAmount)}
                  </Text>
                </View>
                <StatusBadge status={b.status} plain />
              </View>
            ))
          : orders.data?.items.map((o) => (
              <View key={o.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
                <View className="flex-1">
                  <Text className="font-semibold">Order #{o.id} · {o._count.items} item(s)</Text>
                  <Text variant="muted" className="text-xs">
                    {o.tourist.fullName} · {fmtDate(o.createdAt)} · {o.deliveryType} · {lkrText(o.totalAmount)}
                  </Text>
                </View>
                <StatusBadge status={o.status} plain />
              </View>
            ))}
      </QueryState>
    </Screen>
  );
}
