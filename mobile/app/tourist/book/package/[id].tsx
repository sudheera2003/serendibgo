import * as React from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { Row } from '@/components/app/bits';
import { DateField, Field, Stepper } from '@/components/app/form';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { isoDay, lkrText, useMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Booking, TourPackage } from '@/lib/types';

export default function BookPackage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const money = useMoney();
  const [date, setDate] = React.useState<Date | undefined>();
  const [persons, setPersons] = React.useState(2);
  const [notes, setNotes] = React.useState('');
  const q = useQuery({ queryKey: ['package', id], queryFn: () => api.get<{ package: TourPackage }>(`/packages/${id}`) });
  const avail = useQuery({
    queryKey: ['availability', id, date && isoDay(date)],
    queryFn: () => api.get<{ seatsLeft: number }>(`/packages/${id}/availability`, { date: isoDay(date!) }),
    enabled: !!date,
  });
  const p = q.data?.package;
  const seatsLeft = avail.data?.seatsLeft;
  const total = p ? p.pricePerPerson * persons : 0;

  const book = useMutation({
    mutationFn: () => api.post<{ booking: Booking }>('/bookings', { type: 'package', packageId: Number(id), startDate: isoDay(date!), numPersons: persons, notes: notes || undefined }),
    onSuccess: ({ booking }) => {
      qc.invalidateQueries({ queryKey: ['bookings'] });
      toast.success('Booking requested', 'The provider will confirm shortly. You pay only after they accept.');
      router.replace(`/tourist/booking/${booking.id}`);
    },
    onError: (e) => toast.error(e, 'Could not book'),
  });

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => book.mutate()} disabled={!date || book.isPending || (seatsLeft !== undefined && persons > seatsLeft)}>
          <Text>{book.isPending ? 'Sending request…' : `Request booking · ${lkrText(total)}`}</Text>
        </Button>
      }>
      <QueryState query={q}>
        {p ? (
          <>
            <Text className="text-xl font-bold">{p.title}</Text>
            <DateField label="Start date" value={date} onChange={setDate} minDate={addDays(new Date(), 1)} />
            {date ? (
              <Text variant="muted" className="text-sm">
                {avail.isLoading ? 'Checking availability…' : seatsLeft === 0 ? 'This date is fully booked – choose another.' : `${seatsLeft} seat(s) left on this date`}
              </Text>
            ) : null}
            <Field label="Number of people">
              <Stepper value={persons} onChange={setPersons} min={1} max={Math.min(p.maxGroupSize, seatsLeft ?? p.maxGroupSize)} />
            </Field>
            <Field label="Notes for the provider (optional)">
              <Textarea value={notes} onChangeText={setNotes} placeholder="Pickup hotel, dietary needs…" />
            </Field>
            <Card>
              <CardHeader>
                <CardTitle>Price breakdown</CardTitle>
              </CardHeader>
              <CardContent className="gap-1">
                <Row label={`${persons} person(s) × ${lkrText(p.pricePerPerson)}`} value={lkrText(total)} />
                <Separator className="my-2" />
                <Row label="Total" value={money(total)} bold />
                <Text variant="muted" className="mt-2 text-xs">
                  No hidden fees. You will be asked to pay securely after the provider accepts your request.
                </Text>
              </CardContent>
            </Card>
          </>
        ) : null}
      </QueryState>
      <View />
    </Screen>
  );
}
