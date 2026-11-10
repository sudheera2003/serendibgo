import * as React from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { LocateFixedIcon, MapPinIcon, TicketIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, Rating, Section } from '@/components/app/bits';
import { PackageCard } from '@/components/app/cards';
import { RouteMap } from '@/components/app/route-map';
import { ReviewsList } from '@/components/app/reviews-list';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { titleCase, useMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Destination, Paged, TourPackage } from '@/lib/types';

export default function DestinationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const qc = useQueryClient();
  const money = useMoney();
  const [checking, setChecking] = React.useState(false);
  const q = useQuery({ queryKey: ['destination', id], queryFn: () => api.get<{ destination: Destination }>(`/destinations/${id}`) });
  const pkgs = useQuery({ queryKey: ['packages', 'destination', id], queryFn: () => api.get<Paged<TourPackage>>('/packages', { destinationId: id, limit: 5 }) });
  const d = q.data?.destination;

  /** GPS check-in: required before a destination can be reviewed (FR13). */
  const checkIn = async () => {
    setChecking(true);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        toast.info('Location needed', 'Allow location access to check in.');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const res = await api.post<{ checkin: { id: number }; message: string }>('/reviews/checkins', { destinationId: Number(id), lat: pos.coords.latitude, lng: pos.coords.longitude });
      toast.success('Checked in!', res.message);
      qc.invalidateQueries({ queryKey: ['reviews', 'eligibility'] });
      router.push({ pathname: '/tourist/review/new', params: { type: 'checkin', id: String(res.checkin.id), title: d?.name ?? '' } });
    } catch (e) {
      toast.error(e, 'Check-in failed');
    } finally {
      setChecking(false);
    }
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Stack.Screen options={{ title: d?.name ?? 'Destination' }} />
      <QueryState query={q}>
        {d ? (
          <>
            <View className="h-48 overflow-hidden rounded-2xl">
              <Cover uri={d.imageUrl} kind={d.category} iconSize={56} />
            </View>
            <View className="gap-2">
              <Text className="text-2xl font-bold">{d.name}</Text>
              <View className="flex-row items-center gap-1">
                <Icon as={MapPinIcon} className="text-muted-foreground" />
                <Text variant="muted">
                  {d.district}, {d.province} Province · {titleCase(d.category)}
                </Text>
              </View>
              <Rating value={d.avgRating} count={d.reviewCount} size="md" />
              {d.description ? <Text className="leading-6">{d.description}</Text> : null}
              <View className="flex-row items-center gap-2">
                <Icon as={TicketIcon} className="text-muted-foreground" />
                <Text>{Number(d.entryFee) ? `Entrance about ${money(d.entryFee)}` : 'Free to visit'}</Text>
              </View>
            </View>
            <RouteMap points={[{ lat: d.latitude, lng: d.longitude, title: d.name }]} height={180} />
            <View className="flex-row gap-2">
              <Button className="flex-1" variant="outline" onPress={() => router.push({ pathname: '/tourist/trip/new', params: { add: String(d.id) } })}>
                <Text>Add to a trip</Text>
              </Button>
              <Button className="flex-1" onPress={checkIn} disabled={checking}>
                <Icon as={LocateFixedIcon} />
                <Text>{checking ? 'Locating…' : "I'm here – check in"}</Text>
              </Button>
            </View>
            {pkgs.data?.items.length ? (
              <Section title="Tours that visit here">
                {pkgs.data.items.map((p) => (
                  <PackageCard key={p.id} p={p} />
                ))}
              </Section>
            ) : null}
            <ReviewsList targetType="destination" targetId={d.id} avg={d.avgRating} count={d.reviewCount} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
