import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { CarIcon, MountainIcon, PlusIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, Rating, StatusBadge } from '@/components/app/bits';
import { EmptyView, QueryState } from '@/components/app/states';
import { VerificationBanner } from '@/components/app/verification-banner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { lkrText, titleCase } from '@/lib/format';
import type { TourPackage, Vehicle } from '@/lib/types';

export default function Listings() {
  const profile = useAuth((s) => s.user?.providerProfile);
  const [tab, setTab] = React.useState(profile?.providerType === 'vehicle_owner' ? 'vehicles' : 'packages');
  const approved = profile?.verificationStatus === 'approved';
  const pkgs = useQuery({ queryKey: ['provider-packages'], queryFn: () => api.get<{ items: TourPackage[] }>('/provider/packages'), enabled: !!profile });
  const vehicles = useQuery({ queryKey: ['provider-vehicles'], queryFn: () => api.get<{ items: Vehicle[] }>('/provider/vehicles'), enabled: !!profile });
  const active = tab === 'packages' ? pkgs : vehicles;

  return (
    <Screen
      refreshing={active.isRefetching}
      onRefresh={active.refetch}
      footer={
        approved ? (
          <Button size="lg" onPress={() => router.push(tab === 'packages' ? '/provider/package-editor' : '/provider/vehicle-editor')}>
            <Icon as={PlusIcon} />
            <Text>{tab === 'packages' ? 'New tour package' : 'Add a vehicle'}</Text>
          </Button>
        ) : undefined
      }>
      <VerificationBanner status={profile?.verificationStatus} reason={profile?.rejectionReason} applyPath="/provider/application" kind="provider" />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full flex-row">
          <TabsTrigger value="packages" className="flex-1">
            <Text>Tour packages</Text>
          </TabsTrigger>
          <TabsTrigger value="vehicles" className="flex-1">
            <Text>Vehicles</Text>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <QueryState query={active}>
        {tab === 'packages' ? (
          pkgs.data?.items.length ? (
            pkgs.data.items.map((p) => (
              <Pressable key={p.id} onPress={() => router.push({ pathname: '/provider/package-editor', params: { id: String(p.id) } })} className="flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:bg-accent">
                <View className="h-20 w-20 overflow-hidden rounded-xl">
                  <Cover uri={p.imageUrl} kind="package" iconSize={22} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="font-semibold">{p.title}</Text>
                  <Text variant="muted" className="text-xs">
                    {p.durationDays} day(s) · {lkrText(p.pricePerPerson)} pp · max {p.maxGroupSize}
                  </Text>
                  <View className="flex-row items-center gap-2">
                    <StatusBadge status={p.isActive ? 'visible' : 'hidden'} plain />
                    <Rating value={p.avgRating} count={p.reviewCount} />
                  </View>
                </View>
              </Pressable>
            ))
          ) : (
            <EmptyView icon={MountainIcon} title="No tour packages yet" description="Create a package with an itinerary, inclusions and a clear price per person." />
          )
        ) : vehicles.data?.items.length ? (
          vehicles.data.items.map((v) => (
            <Pressable key={v.id} onPress={() => router.push({ pathname: '/provider/vehicle-editor', params: { id: String(v.id) } })} className="flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:bg-accent">
              <View className="h-20 w-20 overflow-hidden rounded-xl">
                <Cover uri={v.imageUrl} kind="vehicle" iconSize={22} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-semibold">{v.makeModel}</Text>
                <Text variant="muted" className="text-xs">
                  {titleCase(v.vehicleType)} · {v.seats} seats · {lkrText(v.pricePerDay)}/day · {v.baseLocation}
                </Text>
                <View className="flex-row items-center gap-2">
                  <StatusBadge status={v.isActive ? 'visible' : 'hidden'} plain />
                  <Rating value={v.avgRating} count={v.reviewCount} />
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyView icon={CarIcon} title="No vehicles yet" description="Add a vehicle with daily and per-km rates. Tourists always see the full price breakdown." />
        )}
      </QueryState>
    </Screen>
  );
}
