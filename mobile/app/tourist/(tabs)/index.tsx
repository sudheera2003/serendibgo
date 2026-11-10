import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import type { LucideIcon } from 'lucide-react-native';
import { CarIcon, MapIcon, MountainIcon, SearchIcon, ShoppingBagIcon, StarIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Section } from '@/components/app/bits';
import { DestinationCard, PackageCard } from '@/components/app/cards';
import { ChipSelect } from '@/components/app/form';
import { LoadingView } from '@/components/app/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { titleCase } from '@/lib/format';
import type { Destination, Paged, TourPackage } from '@/lib/types';

function Action({ icon, label, onPress }: { icon: LucideIcon; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="flex-1 items-center gap-2 rounded-2xl border border-border bg-card p-3 active:bg-accent">
      <View className="rounded-full bg-accent p-3">
        <Icon as={icon} size={22} className="text-primary" />
      </View>
      <Text className="text-center text-xs font-semibold">{label}</Text>
    </Pressable>
  );
}

export default function Explore() {
  const name = useAuth((s) => s.user?.fullName.split(' ')[0]);
  const [search, setSearch] = React.useState('');
  const [category, setCategory] = React.useState<string>('all');
  const cats = useQuery({ queryKey: ['destinations', 'categories'], queryFn: () => api.get<{ items: { category: string }[] }>('/destinations/categories') });
  const dests = useQuery({ queryKey: ['destinations', category], queryFn: () => api.get<Paged<Destination>>('/destinations', { category: category === 'all' ? undefined : category, limit: 12 }) });
  const pkgs = useQuery({ queryKey: ['packages', 'top'], queryFn: () => api.get<Paged<TourPackage>>('/packages', { limit: 4 }) });
  const toReview = useQuery({ queryKey: ['reviews', 'eligibility'], queryFn: () => api.get<{ items: unknown[] }>('/reviews/eligibility') });

  const refresh = () => Promise.all([dests.refetch(), pkgs.refetch(), toReview.refetch()]);

  return (
    <Screen refreshing={dests.isRefetching} onRefresh={refresh}>
      <View className="gap-1">
        <Text className="text-2xl font-bold">Ayubowan{name ? `, ${name}` : ''} 👋</Text>
        <Text variant="muted">Where would you like to go today?</Text>
      </View>
      <View className="flex-row items-center gap-2">
        <View className="flex-1">
          <Input
            value={search}
            onChangeText={setSearch}
            placeholder="Search tours, e.g. Sigiriya"
            returnKeyType="search"
            onSubmitEditing={() => router.push({ pathname: '/tourist/packages', params: { q: search } })}
          />
        </View>
        <Button size="icon" onPress={() => router.push({ pathname: '/tourist/packages', params: { q: search } })} accessibilityLabel="Search">
          <Icon as={SearchIcon} />
        </Button>
      </View>

      <View className="flex-row gap-3">
        <Action icon={MapIcon} label="Plan a trip" onPress={() => router.push('/tourist/trip/new')} />
        <Action icon={MountainIcon} label="Tour packages" onPress={() => router.push('/tourist/packages')} />
        <Action icon={CarIcon} label="Rent a vehicle" onPress={() => router.push('/tourist/vehicles')} />
        <Action icon={ShoppingBagIcon} label="Local market" onPress={() => router.push('/tourist/market')} />
      </View>

      {toReview.data?.items.length ? (
        <Pressable onPress={() => router.push({ pathname: '/tourist/activity', params: { tab: 'review' } })} className="flex-row items-center gap-3 rounded-2xl bg-amber-100 p-4 dark:bg-amber-900/30">
          <Icon as={StarIcon} size={22} className="fill-amber-400 text-amber-500" />
          <View className="flex-1">
            <Text className="font-semibold">Share your experience</Text>
            <Text variant="muted" className="text-sm">
              You have {toReview.data.items.length} verified review{toReview.data.items.length > 1 ? 's' : ''} to write.
            </Text>
          </View>
        </Pressable>
      ) : null}

      <Section title="Discover Sri Lanka">
        <ChipSelect
          options={[{ value: 'all', label: 'All' }, ...(cats.data?.items ?? []).map((c) => ({ value: c.category, label: titleCase(c.category) }))]}
          value={category}
          onChange={setCategory}
        />
        {dests.isLoading ? (
          <LoadingView rows={1} />
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-3 pr-4">
            {dests.data?.items.map((d) => <DestinationCard key={d.id} d={d} compact />)}
          </ScrollView>
        )}
      </Section>

      <Section
        title="Top-rated tours"
        action={
          <Button variant="link" size="sm" onPress={() => router.push('/tourist/packages')}>
            <Text>See all</Text>
          </Button>
        }>
        {pkgs.isLoading ? <LoadingView rows={2} /> : pkgs.data?.items.map((p) => <PackageCard key={p.id} p={p} />)}
      </Section>
    </Screen>
  );
}
