import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MailIcon, PhoneIcon } from 'lucide-react-native';
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
import { fmtDate, fmtDateTime, lkrText } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Booking } from '@/lib/types';

export default function ProviderBooking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ['booking', id], queryFn: () => api.get<{ booking: Booking }>(`/bookings/${id}`) });
  const b = q.data?.booking;

  const set = useMutation({
    mutationFn: ({ status, reason }: { status: string; reason?: string }) => api.patch(`/bookings/${id}/status`, { status, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider-bookings'] });
      q.refetch();
      toast.success('Booking updated');
    },
    onError: (e) => toast.error(e),
  });
  const decline = async () => {
    const { ok, text } = await confirm({ title: 'Decline this request?', input: { placeholder: 'Reason (optional)' }, confirmLabel: 'Decline', destructive: true });
    if (ok) set.mutate({ status: 'declined', reason: text });
  };
  const started = b ? new Date(b.startDate) <= new Date() : false;

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        b?.status === 'pending' ? (
          <View className="flex-row gap-2">
            <Button variant="outline" className="flex-1" onPress={decline}>
              <Text>Decline</Text>
            </Button>
            <Button className="flex-1" onPress={() => set.mutate({ status: 'accepted' })}>
              <Text>Accept</Text>
            </Button>
          </View>
        ) : b?.status === 'confirmed' ? (
          <Button size="lg" onPress={() => set.mutate({ status: 'completed' })} disabled={!started}>
            <Text>{started ? (b.bookingType === 'vehicle' ? 'Vehicle returned – mark completed' : 'Mark tour as completed') : `Can be completed from ${fmtDate(b.startDate)}`}</Text>
          </Button>
        ) : undefined
      }>
      <QueryState query={q}>
        {b ? (
          <>
            <View className="gap-1">
              <Text className="text-xl font-bold">{b.package?.title ?? b.vehicle?.makeModel}</Text>
              <View className="flex-row">
                <StatusBadge status={b.status} plain />
              </View>
            </View>
            <Card>
              <CardHeader>
                <CardTitle>Customer</CardTitle>
              </CardHeader>
              <CardContent className="gap-2">
                <Text className="font-semibold">{b.tourist.fullName}</Text>
                {['accepted', 'confirmed', 'completed'].includes(b.status) ? (
                  <>
                    <View className="flex-row items-center gap-2">
                      <Icon as={MailIcon} className="text-muted-foreground" />
                      <Text>{b.tourist.email}</Text>
                    </View>
                    {b.tourist.phone ? (
                      <View className="flex-row items-center gap-2">
                        <Icon as={PhoneIcon} className="text-muted-foreground" />
                        <Text>{b.tourist.phone}</Text>
                      </View>
                    ) : null}
                  </>
                ) : (
                  <Text variant="muted" className="text-xs">
                    Contact details are shared after you accept.
                  </Text>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Booking #{b.id}</CardTitle>
              </CardHeader>
              <CardContent className="gap-1">
                <Row label={b.bookingType === 'vehicle' ? 'Pickup' : 'Start'} value={fmtDate(b.startDate)} />
                <Row label={b.bookingType === 'vehicle' ? 'Return' : 'End'} value={fmtDate(b.endDate)} />
                {b.bookingType === 'package' ? <Row label="People" value={String(b.numPersons)} /> : <Row label="Estimated distance" value={`${b.estimatedKm} km`} />}
                {b.notes ? <Row label="Notes" value={b.notes} /> : null}
                <Row label="Requested" value={fmtDateTime(b.createdAt)} />
                <Separator className="my-2" />
                {b.priceBreakdown.map((l) => (
                  <Row key={l.label} label={l.label} value={lkrText(l.amount)} />
                ))}
                <Row label="Total" value={lkrText(b.totalAmount)} bold />
                <Row label="Payment" value={b.payments[0] ? <StatusBadge status={b.payments[0].status} plain /> : 'Not paid yet'} />
              </CardContent>
            </Card>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
