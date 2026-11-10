import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2Icon, CircleIcon, CreditCardIcon, StarIcon, XCircleIcon } from 'lucide-react-native';
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
import { fmtDate, fmtDateTime, lkrText, useMoney } from '@/lib/format';
import { pay } from '@/lib/pay';
import { toast } from '@/lib/toast';
import type { Booking, BookingStatus } from '@/lib/types';

const FLOW: { status: BookingStatus; label: string }[] = [
  { status: 'pending', label: 'Requested' },
  { status: 'accepted', label: 'Accepted by provider' },
  { status: 'confirmed', label: 'Paid & confirmed' },
  { status: 'completed', label: 'Completed' },
];

function Timeline({ status }: { status: BookingStatus }) {
  if (status === 'declined' || status === 'cancelled') {
    return (
      <View className="flex-row items-center gap-2 rounded-xl bg-muted p-3">
        <Icon as={XCircleIcon} className="text-destructive" />
        <Text>This booking was {status}.</Text>
      </View>
    );
  }
  const idx = FLOW.findIndex((f) => f.status === status);
  return (
    <View className="gap-2">
      {FLOW.map((f, i) => (
        <View key={f.status} className="flex-row items-center gap-3">
          <Icon as={i <= idx ? CheckCircle2Icon : CircleIcon} size={18} className={i <= idx ? 'text-primary' : 'text-muted-foreground/40'} />
          <Text className={i <= idx ? 'font-medium' : 'text-muted-foreground'}>{f.label}</Text>
        </View>
      ))}
    </View>
  );
}

export default function BookingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const money = useMoney();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api.get<{ booking: Booking }>(`/bookings/${id}`) });
  const b = q.data?.booking;

  const payNow = useMutation({ mutationFn: () => pay({ bookingId: Number(id) }), onSettled: () => q.refetch() });
  const cancel = async () => {
    const { ok } = await confirm({
      title: 'Cancel this booking?',
      description: b?.status === 'confirmed' ? 'Your payment will be refunded according to the cancellation policy.' : undefined,
      confirmLabel: 'Cancel booking',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.patch(`/bookings/${id}/status`, { status: 'cancelled' });
      qc.invalidateQueries({ queryKey: ['bookings'] });
      q.refetch();
      toast.success('Booking cancelled');
    } catch (e) {
      toast.error(e);
    }
  };

  const name = b?.package?.title ?? b?.vehicle?.makeModel;
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        b?.status === 'accepted' ? (
          <Button size="lg" onPress={() => payNow.mutate()} disabled={payNow.isPending}>
            <Icon as={CreditCardIcon} />
            <Text>{payNow.isPending ? 'Waiting for payment…' : `Pay ${lkrText(b.totalAmount)} securely`}</Text>
          </Button>
        ) : b?.status === 'completed' && !b.review ? (
          <Button size="lg" onPress={() => router.push({ pathname: '/tourist/review/new', params: { type: 'booking', id: String(b.id), title: name ?? '' } })}>
            <Icon as={StarIcon} />
            <Text>Write a verified review</Text>
          </Button>
        ) : undefined
      }>
      <QueryState query={q}>
        {b ? (
          <>
            <View className="gap-1">
              <Text className="text-xl font-bold">{name}</Text>
              <Text variant="muted">
                {b.bookingType === 'package' ? `by ${b.package?.provider.businessName}` : `${b.vehicle?.withDriver ? 'With driver' : 'Self-drive'} · ${b.vehicle?.provider.businessName}`}
              </Text>
              <View className="mt-1 flex-row">
                <StatusBadge status={b.status} />
              </View>
            </View>
            <Card>
              <CardContent className="pt-0">
                <Timeline status={b.status} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Details</CardTitle>
              </CardHeader>
              <CardContent className="gap-1">
                <Row label="Booking reference" value={`#${b.id}`} />
                <Row label={b.bookingType === 'vehicle' ? 'Pickup' : 'Start'} value={fmtDate(b.startDate)} />
                <Row label={b.bookingType === 'vehicle' ? 'Return' : 'End'} value={fmtDate(b.endDate)} />
                {b.bookingType === 'package' ? <Row label="People" value={String(b.numPersons)} /> : <Row label="Pickup town" value={b.vehicle?.baseLocation ?? '—'} />}
                {b.notes ? <Row label="Notes" value={b.notes} /> : null}
                <Row label="Requested" value={fmtDateTime(b.createdAt)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Price breakdown</CardTitle>
              </CardHeader>
              <CardContent className="gap-1">
                {b.priceBreakdown.map((l) => (
                  <Row key={l.label} label={l.label} value={lkrText(l.amount)} />
                ))}
                <Separator className="my-2" />
                <Row label="Total" value={money(b.totalAmount)} bold />
                {b.payments.map((p) => (
                  <Row key={p.id} label={`Payment ${p.paidAt ? fmtDate(p.paidAt) : ''}`} value={<StatusBadge status={p.status} plain />} />
                ))}
              </CardContent>
            </Card>
            {b.status === 'pending' ? (
              <Text variant="muted" className="text-center text-sm">
                Waiting for {b.package?.provider.businessName ?? b.vehicle?.provider.businessName} to accept. You will be notified – no payment is taken until then.
              </Text>
            ) : null}
            {['pending', 'accepted', 'confirmed'].includes(b.status) ? (
              <Button variant="outline" onPress={cancel}>
                <Text>Cancel booking</Text>
              </Button>
            ) : null}
            <Button variant="ghost" onPress={() => router.push({ pathname: '/tourist/complaints/new', params: { targetType: 'booking', targetId: String(b.id) } })}>
              <Text className="text-muted-foreground">Report a problem</Text>
            </Button>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
