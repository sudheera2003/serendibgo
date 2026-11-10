import * as React from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, Rating, Row, Section, VerifiedBadge } from '@/components/app/bits';
import { DateField, Field } from '@/components/app/form';
import { ReviewsList } from '@/components/app/reviews-list';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDate, isoDay, lkrText, titleCase, useMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Booking, QuoteLine, Vehicle } from '@/lib/types';

export default function VehicleScreen() {
  const params = useLocalSearchParams<{ id: string; from?: string; to?: string; km?: string }>();
  const qc = useQueryClient();
  const money = useMoney();
  const [from, setFrom] = React.useState<Date>(params.from ? parseISO(params.from) : addDays(new Date(), 1));
  const [to, setTo] = React.useState<Date>(params.to ? parseISO(params.to) : addDays(new Date(), 3));
  const [km, setKm] = React.useState(params.km && params.km !== '0' ? params.km : '');

  const q = useQuery({ queryKey: ['vehicle', params.id], queryFn: () => api.get<{ vehicle: Vehicle; unavailable: { startDate: string; endDate: string }[] }>(`/vehicles/${params.id}`) });
  const quote = useQuery({
    queryKey: ['quote', params.id, isoDay(from), isoDay(to), km],
    queryFn: () => api.get<{ quote: { lines: QuoteLine[]; total: number; days: number }; available: boolean }>(`/vehicles/${params.id}/quote`, { from: isoDay(from), to: isoDay(to), km: km || 0 }),
  });
  const v = q.data?.vehicle;

  const book = useMutation({
    mutationFn: () => api.post<{ booking: Booking }>('/bookings', { type: 'vehicle', vehicleId: Number(params.id), startDate: isoDay(from), endDate: isoDay(to), estimatedKm: Number(km || 0) }),
    onSuccess: ({ booking }) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Rental requested', 'The owner will confirm shortly. You pay only after they accept.');
      router.replace(`/tourist/booking/${booking.id}`);
    },
    onError: (e) => toast.error(e, 'Could not book'),
  });

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => book.mutate()} disabled={!quote.data?.available || book.isPending}>
          <Text>{!quote.data ? 'Getting price…' : !quote.data.available ? 'Not available for these dates' : `Request rental · ${lkrText(quote.data.quote.total)}`}</Text>
        </Button>
      }>
      <Stack.Screen options={{ title: v?.makeModel ?? 'Vehicle' }} />
      <QueryState query={q}>
        {v ? (
          <>
            <View className="h-44 overflow-hidden rounded-2xl">
              <Cover uri={v.imageUrl} kind={v.vehicleType === 'minibus' || v.vehicleType === 'bus' ? 'bus' : 'vehicle'} iconSize={56} />
            </View>
            <View className="gap-1">
              <Text className="text-2xl font-bold">{v.makeModel}</Text>
              <Text variant="muted">
                {titleCase(v.vehicleType)} · {v.seats} seats · {v.withDriver ? 'With driver' : 'Self-drive'} · based in {v.baseLocation}
              </Text>
              <Rating value={v.avgRating} count={v.reviewCount} size="md" />
              <View className="mt-1 flex-row items-center gap-2">
                <Text variant="muted">Owner: {v.provider.businessName}</Text>
                <VerifiedBadge />
              </View>
            </View>

            <Section title="Your rental">
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <DateField label="Pickup" value={from} onChange={(d) => { setFrom(d); if (to < d) setTo(d); }} minDate={new Date()} />
                </View>
                <View className="flex-1">
                  <DateField label="Return" value={to} onChange={setTo} minDate={from} />
                </View>
              </View>
              {Number(v.pricePerKm) > 0 ? (
                <Field label="Estimated distance (km)" hint="Use your trip planner total, or leave empty and pay per km at return.">
                  <Input value={km} onChangeText={(t) => setKm(t.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="e.g. 250" />
                </Field>
              ) : null}
            </Section>

            <Card>
              <CardHeader>
                <CardTitle>Price breakdown</CardTitle>
              </CardHeader>
              <CardContent className="gap-1">
                {quote.data?.quote.lines.map((l) => <Row key={l.label} label={l.label} value={lkrText(l.amount)} />)}
                <Separator className="my-2" />
                <Row label="Total" value={quote.data ? money(quote.data.quote.total) : '…'} bold />
                <Text variant="muted" className="mt-2 text-xs">
                  Every charge is shown above. Fuel is included in the per-km rate where it applies.
                </Text>
              </CardContent>
            </Card>

            {q.data!.unavailable.length ? (
              <Section title="Already booked">
                {q.data!.unavailable.map((u, i) => (
                  <Text key={i} variant="muted">
                    {fmtDate(u.startDate)} – {fmtDate(u.endDate)}
                  </Text>
                ))}
              </Section>
            ) : null}
            <ReviewsList targetType="vehicle" targetId={v.id} avg={v.avgRating} count={v.reviewCount} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
