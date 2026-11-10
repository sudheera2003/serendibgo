import * as React from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BuildingIcon, PackageCheckIcon, StoreIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtDateTime, lkrText } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { ItemStatus } from '@/lib/types';

interface VendorItem {
  id: number;
  quantity: number;
  unitPrice: number;
  itemStatus: ItemStatus;
  product: { id: number; name: string };
  order: { id: number; deliveryType: 'hotel' | 'pickup'; hotelName: string | null; deliveryAddress: string | null; createdAt: string; tourist: { fullName: string; phone: string | null } };
}

const NEXT: Partial<Record<ItemStatus, { to: ItemStatus; label: string }>> = {
  pending: { to: 'packed', label: 'Mark packed' },
  packed: { to: 'dispatched', label: 'Mark dispatched' },
  dispatched: { to: 'delivered', label: 'Mark delivered' },
};
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'New' },
  { value: 'packed', label: 'Packed' },
  { value: 'dispatched', label: 'On the way' },
  { value: 'delivered', label: 'Delivered' },
];

export default function VendorOrders() {
  const hasShop = useAuth((s) => !!s.user?.vendorProfile);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = React.useState('');
  const q = useQuery({ queryKey: ['vendor-items', status], queryFn: () => api.get<{ items: VendorItem[] }>('/vendor/order-items', { status: status || undefined }), enabled: hasShop });
  const update = useMutation({
    mutationFn: ({ id, to }: { id: number; to: ItemStatus }) => api.patch(`/vendor/order-items/${id}/status`, { status: to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-items'] });
      qc.invalidateQueries({ queryKey: ['vendor-sales'] });
      toast.success('Status updated', 'The customer has been notified.');
    },
    onError: (e) => toast.error(e),
  });
  const cancel = async (i: VendorItem) => {
    const { ok } = await confirm({ title: 'Cancel this item?', description: 'The stock goes back on sale and the customer is notified.', destructive: true, confirmLabel: 'Cancel item' });
    if (ok) update.mutate({ id: i.id, to: 'cancelled' });
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ChipSelect options={FILTERS} value={status} onChange={setStatus} />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((i) => {
            const next = NEXT[i.itemStatus];
            return (
              <View key={i.id} className="gap-3 rounded-2xl border border-border bg-card p-4">
                <View className="flex-row items-start justify-between gap-2">
                  <View className="flex-1">
                    <Text className="font-semibold">
                      {i.quantity} × {i.product.name}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      Order #{i.order.id} · {fmtDateTime(i.order.createdAt)} · {lkrText(Number(i.unitPrice) * i.quantity)}
                    </Text>
                  </View>
                  <StatusBadge status={i.itemStatus} plain />
                </View>
                <View className="flex-row items-start gap-2 rounded-lg bg-muted p-3">
                  <Icon as={i.order.deliveryType === 'hotel' ? BuildingIcon : StoreIcon} className="mt-0.5 text-muted-foreground" />
                  <View className="flex-1">
                    <Text className="text-sm font-medium">{i.order.tourist.fullName}{i.order.tourist.phone ? ` · ${i.order.tourist.phone}` : ''}</Text>
                    <Text variant="muted" className="text-sm">
                      {i.order.deliveryType === 'hotel' ? `Deliver to ${i.order.hotelName}, ${i.order.deliveryAddress}` : 'Customer will pick up from your shop'}
                    </Text>
                  </View>
                </View>
                {next ? (
                  <View className="flex-row gap-2">
                    {i.itemStatus !== 'dispatched' ? (
                      <Button variant="ghost" onPress={() => cancel(i)}>
                        <Text className="text-destructive">Cancel</Text>
                      </Button>
                    ) : null}
                    <Button className="flex-1" onPress={() => update.mutate({ id: i.id, to: next.to })} disabled={update.isPending}>
                      <Text>{next.label}</Text>
                    </Button>
                  </View>
                ) : null}
              </View>
            );
          })
        ) : (
          <EmptyView icon={PackageCheckIcon} title="No orders to show" description="Paid orders for your products appear here." />
        )}
      </QueryState>
    </Screen>
  );
}
