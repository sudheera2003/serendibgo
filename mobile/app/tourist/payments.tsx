import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ReceiptIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { ListRow, StatusBadge } from '@/components/app/bits';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDateTime, lkrText } from '@/lib/format';

interface PaymentRow {
  id: number;
  amount: number;
  status: string;
  gatewayRef: string;
  method: string | null;
  paidAt: string | null;
  createdAt: string;
  booking: { id: number; package: { title: string } | null; vehicle: { makeModel: string } | null } | null;
  order: { id: number } | null;
}

export default function Payments() {
  const q = useQuery({ queryKey: ['payments', 'mine'], queryFn: () => api.get<{ items: PaymentRow[] }>('/payments/mine') });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((p) => (
            <ListRow
              key={p.id}
              icon={ReceiptIcon}
              title={`${lkrText(p.amount)} · ${p.booking ? (p.booking.package?.title ?? p.booking.vehicle?.makeModel) : `Order #${p.order?.id}`}`}
              subtitle={`Ref ${p.gatewayRef} · ${fmtDateTime(p.paidAt ?? p.createdAt)}`}
              right={<StatusBadge status={p.status} plain />}
              onPress={() => router.push(p.booking ? `/tourist/booking/${p.booking.id}` : `/tourist/order/${p.order?.id}`)}
            />
          ))
        ) : (
          <EmptyView icon={ReceiptIcon} title="No payments yet" />
        )}
      </QueryState>
      <View>
        <Text variant="muted" className="text-center text-xs">
          Payments are processed by PayHere and settled in Sri Lankan rupees.
        </Text>
      </View>
    </Screen>
  );
}
