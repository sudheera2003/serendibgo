import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CalendarDaysIcon, CheckIcon, InfoIcon, UsersIcon, XIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, Rating, Section, VerifiedBadge } from '@/components/app/bits';
import { RouteMap } from '@/components/app/route-map';
import { ReviewsList } from '@/components/app/reviews-list';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { titleCase, useMoney } from '@/lib/format';
import type { TourPackage } from '@/lib/types';

export default function PackageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const money = useMoney();
  const q = useQuery({ queryKey: ['package', id], queryFn: () => api.get<{ package: TourPackage }>(`/packages/${id}`) });
  const p = q.data?.package;
  const days = p ? [...new Set(p.destinations.map((d) => d.dayNo))].sort((a, b) => a - b) : [];

  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        p ? (
          <View className="flex-row items-center gap-3">
            <View className="flex-1">
              <Text className="text-lg font-bold">{money(p.pricePerPerson).split(' (')[0]}</Text>
              <Text variant="muted" className="text-xs">
                per person · all listed inclusions
              </Text>
            </View>
            <Button size="lg" onPress={() => router.push(`/tourist/book/package/${p.id}`)}>
              <Text>Book now</Text>
            </Button>
          </View>
        ) : undefined
      }>
      <Stack.Screen options={{ title: p?.title ?? 'Tour package' }} />
      <QueryState query={q}>
        {p ? (
          <>
            <View className="h-44 overflow-hidden rounded-2xl">
              <Cover uri={p.imageUrl} kind="package" iconSize={56} />
            </View>
            <View className="gap-2">
              <Text className="text-2xl font-bold">{p.title}</Text>
              <View className="flex-row flex-wrap items-center gap-3">
                <View className="flex-row items-center gap-1">
                  <Icon as={CalendarDaysIcon} className="text-muted-foreground" />
                  <Text>
                    {p.durationDays} day{p.durationDays > 1 ? 's' : ''}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1">
                  <Icon as={UsersIcon} className="text-muted-foreground" />
                  <Text>Up to {p.maxGroupSize} people</Text>
                </View>
                <Rating value={p.avgRating} count={p.reviewCount} />
              </View>
              <Text className="leading-6">{p.description}</Text>
            </View>

            <Card>
              <CardContent className="flex-row items-center gap-3">
                <View className="flex-1 gap-1">
                  <Text className="font-semibold">{p.provider.businessName}</Text>
                  <Text variant="muted" className="text-xs">
                    {titleCase(p.provider.providerType)}
                  </Text>
                  <Rating value={p.provider.avgRating} count={p.provider.reviewCount} />
                </View>
                <VerifiedBadge label="Licence verified" />
              </CardContent>
            </Card>

            <Section title="Itinerary">
              <RouteMap points={p.destinations.map((d) => ({ lat: d.destination.latitude, lng: d.destination.longitude, title: d.destination.name }))} height={200} />
              {days.map((day) => (
                <View key={day} className="flex-row gap-3">
                  <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                    <Text className="text-xs font-bold text-primary-foreground">D{day}</Text>
                  </View>
                  <View className="flex-1 gap-1 pt-1">
                    {p.destinations
                      .filter((d) => d.dayNo === day)
                      .map((d) => (
                        <Text key={d.destinationId} className="font-medium" onPress={() => router.push(`/tourist/destination/${d.destinationId}`)}>
                          {d.destination.name} <Text variant="muted">· {d.destination.district}</Text>
                        </Text>
                      ))}
                  </View>
                </View>
              ))}
            </Section>

            <View className="flex-row gap-3">
              <View className="flex-1 gap-2 rounded-xl border border-border p-4">
                <Text className="font-semibold">Included</Text>
                {p.inclusions.map((i) => (
                  <View key={i} className="flex-row items-start gap-2">
                    <Icon as={CheckIcon} className="mt-0.5 text-primary" />
                    <Text className="flex-1 text-sm">{i}</Text>
                  </View>
                ))}
              </View>
              <View className="flex-1 gap-2 rounded-xl border border-border p-4">
                <Text className="font-semibold">Not included</Text>
                {p.exclusions.map((i) => (
                  <View key={i} className="flex-row items-start gap-2">
                    <Icon as={XIcon} className="mt-0.5 text-muted-foreground" />
                    <Text className="flex-1 text-sm">{i}</Text>
                  </View>
                ))}
              </View>
            </View>
            {p.cancellationPolicy ? (
              <View className="flex-row gap-2 rounded-xl bg-muted p-3">
                <Icon as={InfoIcon} className="mt-0.5 text-muted-foreground" />
                <Text variant="muted" className="flex-1 text-sm">
                  {p.cancellationPolicy}
                </Text>
              </View>
            ) : null}
            <ReviewsList targetType="package" targetId={p.id} avg={p.avgRating} count={p.reviewCount} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
