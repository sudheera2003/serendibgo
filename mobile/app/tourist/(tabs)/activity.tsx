import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { PackageIcon, StarIcon, TicketIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, StatusBadge } from '@/components/app/bits';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDate, fmtDateShort, useMoney } from '@/lib/format';
import type { Booking, Order, Paged } from '@/lib/types';

interface Eligible {
  source: { type: 'booking' | 'order_item' | 'checkin'; id: number };
  targetType: string;
  title: string;
  imageUrl: string | null;
  date: string;
}

export default function Activity() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = React.useState(params.tab ?? 'bookings');
  React.useEffect(() => {
    if (params.tab) setTab(params.tab);
  }, [params.tab]);
  const money = useMoney();

  const bookings = useQuery({ queryKey: ['bookings', 'mine'], queryFn: () => api.get<Paged<Booking>>('/bookings', { limit: 50 }) });
  const orders = useQuery({ queryKey: ['orders', 'mine'], queryFn: () => api.get<Paged<Order>>('/market/orders', { limit: 50 }) });
  const eligible = useQuery({ queryKey: ['reviews', 'eligibility'], queryFn: () => api.get<{ items: Eligible[] }>('/reviews/eligibility') });
  const active = tab === 'bookings' ? bookings : tab === 'orders' ? orders : eligible;

  return (
    <Screen refreshing={active.isRefetching} onRefresh={active.refetch}>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-row">
          <TabsTrigger value="bookings" className="flex-1">
            <Text>Bookings</Text>
          </TabsTrigger>
          <TabsTrigger value="orders" className="flex-1">
            <Text>Orders</Text>
          </TabsTrigger>
          <TabsTrigger value="review" className="flex-1">
            <Text>To review{eligible.data?.items.length ? ` (${eligible.data.items.length})` : ''}</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {tab === 'bookings' ? (
        <QueryState query={bookings}>
          {bookings.data?.items.length ? (
            bookings.data.items.map((b) => (
              <Pressable key={b.id} onPress={() => router.push(`/tourist/booking/${b.id}`)} className="flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:bg-accent">
                <View className="h-20 w-20 overflow-hidden rounded-xl">
                  <Cover uri={b.package?.imageUrl ?? b.vehicle?.imageUrl} kind={b.bookingType === 'package' ? 'package' : 'vehicle'} iconSize={24} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-semibold" numberOfLines={1}>
                    {b.package?.title ?? b.vehicle?.makeModel}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {fmtDateShort(b.startDate)}
                    {b.endDate !== b.startDate ? ` – ${fmtDate(b.endDate)}` : `, ${new Date(b.startDate).getFullYear()}`} · {money(b.totalAmount).split(' (')[0]}
                  </Text>
                  <StatusBadge status={b.status} />
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyView icon={TicketIcon} title="No bookings yet" description="Book a tour package or rent a vehicle to see it here." action={<Button onPress={() => router.push('/tourist/packages')}><Text>Browse tours</Text></Button>} />
          )}
        </QueryState>
      ) : null}

      {tab === 'orders' ? (
        <QueryState query={orders}>
          {orders.data?.items.length ? (
            orders.data.items.map((o) => (
              <Pressable key={o.id} onPress={() => router.push(`/tourist/order/${o.id}`)} className="gap-2 rounded-2xl border border-border bg-card p-4 active:bg-accent">
                <View className="flex-row items-center justify-between">
                  <Text className="font-semibold">Order #{o.id}</Text>
                  <StatusBadge status={o.status} />
                </View>
                <Text variant="muted" className="text-sm" numberOfLines={1}>
                  {o.items.map((i) => `${i.quantity}× ${i.product.name}`).join(', ')}
                </Text>
                <View className="flex-row justify-between">
                  <Text variant="muted" className="text-xs">
                    {fmtDate(o.createdAt)} · {o.deliveryType === 'hotel' ? `Deliver to ${o.hotelName}` : 'Pickup'}
                  </Text>
                  <Text className="font-bold">{money(o.totalAmount).split(' (')[0]}</Text>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyView icon={PackageIcon} title="No orders yet" description="Authentic spices, tea and crafts are waiting in the artisan market." />
          )}
        </QueryState>
      ) : null}

      {tab === 'review' ? (
        <QueryState query={eligible}>
          {eligible.data?.items.length ? (
            eligible.data.items.map((e) => (
              <View key={`${e.source.type}-${e.source.id}`} className="flex-row items-center gap-3 rounded-2xl border border-border bg-card p-3">
                <View className="h-14 w-14 overflow-hidden rounded-xl">
                  <Cover uri={e.imageUrl} kind={e.targetType === 'destination' ? 'heritage' : e.targetType} iconSize={20} />
                </View>
                <View className="flex-1">
                  <Text className="font-semibold" numberOfLines={1}>
                    {e.title}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {e.source.type === 'checkin' ? 'Visited' : e.source.type === 'order_item' ? 'Delivered' : 'Completed'} {fmtDate(e.date)}
                  </Text>
                </View>
                <Button size="sm" onPress={() => router.push({ pathname: '/tourist/review/new', params: { type: e.source.type, id: String(e.source.id), title: e.title } })}>
                  <Icon as={StarIcon} />
                  <Text>Review</Text>
                </Button>
              </View>
            ))
          ) : (
            <EmptyView icon={StarIcon} title="Nothing to review right now" description="After a completed booking, a delivered order or a GPS check-in, you can write a verified review." />
          )}
        </QueryState>
      ) : null}
    </Screen>
  );
}
