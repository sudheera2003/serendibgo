import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CreditCardIcon, StarIcon, StoreIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Row, StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDateTime, lkrText, useMoney } from '@/lib/format';
import { pay } from '@/lib/pay';
import { toast } from '@/lib/toast';
import type { ItemStatus, Order } from '@/lib/types';
import { cn } from '@/lib/utils';

const STEPS: ItemStatus[] = ['pending', 'packed', 'dispatched', 'delivered'];

function Progress({ status }: { status: ItemStatus }) {
  if (status === 'cancelled') return <StatusBadge status="cancelled" />;
  const idx = STEPS.indexOf(status);
  return (
    <View className="flex-row items-center gap-1">
      {STEPS.map((s, i) => (
        <View key={s} className="flex-1 gap-1">
          <View className={cn('h-1.5 rounded-full', i <= idx ? 'bg-primary' : 'bg-muted')} />
          <Text className={cn('text-[10px]', i <= idx ? 'text-foreground' : 'text-muted-foreground')}>{s === 'pending' ? 'Ordered' : s[0].toUpperCase() + s.slice(1)}</Text>
        </View>
      ))}
    </View>
  );
}

export default function OrderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const money = useMoney();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ['order', id], queryFn: () => api.get<{ order: Order }>(`/market/orders/${id}`) });
  const o = q.data?.order;
  const vendors = o ? [...new Map(o.items.map((i) => [i.vendorId, i.vendor.shopName])).entries()] : [];

  const payNow = useMutation({ mutationFn: () => pay({ orderId: Number(id) }), onSettled: () => q.refetch() });
  const cancel = async () => {
    const { ok } = await confirm({ title: 'Cancel this order?', description: 'Nothing has been charged yet.', confirmLabel: 'Cancel order', destructive: true });
    if (!ok) return;
    try {
      await api.post(`/market/orders/${id}/cancel`);
      qc.invalidateQueries({ queryKey: ['orders'] });
      q.refetch();
      toast.success('Order cancelled');
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        o?.status === 'pending_payment' ? (
          <View className="flex-row gap-2">
            <Button variant="outline" onPress={cancel}>
              <Text>Cancel</Text>
            </Button>
            <Button className="flex-1" size="lg" onPress={() => payNow.mutate()} disabled={payNow.isPending}>
              <Icon as={CreditCardIcon} />
              <Text>{payNow.isPending ? 'Waiting for payment…' : `Pay ${lkrText(o.totalAmount)}`}</Text>
            </Button>
          </View>
        ) : undefined
      }>
      <QueryState query={q}>
        {o ? (
          <>
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-xl font-bold">Order #{o.id}</Text>
                <Text variant="muted" className="text-xs">
                  {fmtDateTime(o.createdAt)}
                </Text>
              </View>
              <StatusBadge status={o.status} />
            </View>
            <Text variant="muted">{o.deliveryType === 'hotel' ? `Delivery to ${o.hotelName}, ${o.deliveryAddress}` : 'Pickup from each artisan'}</Text>
            {vendors.map(([vid, name]) => (
              <Card key={vid}>
                <CardHeader className="flex-row items-center gap-2">
                  <Icon as={StoreIcon} className="text-primary" />
                  <CardTitle>{name}</CardTitle>
                </CardHeader>
                <CardContent className="gap-4">
                  {o.items
                    .filter((i) => i.vendorId === vid)
                    .map((i) => (
                      <View key={i.id} className="gap-2">
                        <View className="flex-row justify-between gap-3">
                          <Text className="flex-1">
                            {i.quantity} × {i.product.name}
                          </Text>
                          <Text className="font-semibold">{lkrText(Number(i.unitPrice) * i.quantity)}</Text>
                        </View>
                        {o.status !== 'pending_payment' ? <Progress status={i.itemStatus} /> : null}
                        {i.itemStatus === 'delivered' && !i.review ? (
                          <Button size="sm" variant="outline" className="self-start" onPress={() => router.push({ pathname: '/tourist/review/new', params: { type: 'order_item', id: String(i.id), title: i.product.name } })}>
                            <Icon as={StarIcon} />
                            <Text>Write a verified review</Text>
                          </Button>
                        ) : null}
                      </View>
                    ))}
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="gap-1 pt-0">
                <Row label="Total" value={money(o.totalAmount)} bold />
                <Separator className="my-2" />
                {o.payments.map((p) => (
                  <Row key={p.id} label={`Payment #${p.id}`} value={<StatusBadge status={p.status} plain />} />
                ))}
              </CardContent>
            </Card>
            {o.status !== 'pending_payment' ? (
              <Button variant="ghost" onPress={() => router.push({ pathname: '/tourist/complaints/new', params: { targetType: 'order', targetId: String(o.id) } })}>
                <Text className="text-muted-foreground">Problem with this order?</Text>
              </Button>
            ) : null}
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
