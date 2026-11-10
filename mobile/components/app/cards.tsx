import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { CalendarDaysIcon, MapPinIcon, UsersIcon } from 'lucide-react-native';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Cover, Rating, VerifiedBadge } from '@/components/app/bits';
import { useMoney, titleCase } from '@/lib/format';
import type { Destination, Product, TourPackage, Vehicle } from '@/lib/types';
import { cn } from '@/lib/utils';

export function DestinationCard({ d, compact }: { d: Destination; compact?: boolean }) {
  return (
    <Pressable onPress={() => router.push(`/tourist/destination/${d.id}`)} className={cn('overflow-hidden rounded-2xl border border-border bg-card active:opacity-80', compact ? 'w-44' : 'w-full')}>
      <View className={compact ? 'h-24' : 'h-32'}>
        <Cover uri={d.imageUrl} kind={d.category} />
      </View>
      <View className="gap-1 p-3">
        <Text className="font-semibold" numberOfLines={1}>
          {d.name}
        </Text>
        <View className="flex-row items-center gap-1">
          <Icon as={MapPinIcon} size={12} className="text-muted-foreground" />
          <Text variant="muted" className="text-xs" numberOfLines={1}>
            {d.district} · {titleCase(d.category)}
          </Text>
        </View>
        <Rating value={d.avgRating} count={d.reviewCount} />
      </View>
    </Pressable>
  );
}

export function PackageCard({ p, selectable, selected, onToggle }: { p: TourPackage; selectable?: boolean; selected?: boolean; onToggle?: () => void }) {
  const money = useMoney();
  return (
    <Pressable onPress={() => router.push(`/tourist/package/${p.id}`)} className="overflow-hidden rounded-2xl border border-border bg-card active:opacity-80">
      <View className="h-28">
        <Cover uri={p.imageUrl} kind="package" />
        {selectable ? (
          <Pressable onPress={onToggle} className="absolute right-2 top-2 flex-row items-center gap-2 rounded-full bg-background/90 px-3 py-1.5" accessibilityLabel="Select to compare">
            <Checkbox checked={!!selected} onCheckedChange={() => onToggle?.()} />
            <Text className="text-xs font-semibold">Compare</Text>
          </Pressable>
        ) : null}
      </View>
      <View className="gap-2 p-4">
        <Text className="text-base font-bold">{p.title}</Text>
        <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
          <View className="flex-row items-center gap-1">
            <Icon as={CalendarDaysIcon} size={13} className="text-muted-foreground" />
            <Text variant="muted" className="text-xs">
              {p.durationDays} day{p.durationDays > 1 ? 's' : ''}
            </Text>
          </View>
          <View className="flex-row items-center gap-1">
            <Icon as={UsersIcon} size={13} className="text-muted-foreground" />
            <Text variant="muted" className="text-xs">
              Up to {p.maxGroupSize}
            </Text>
          </View>
          <Rating value={p.avgRating} count={p.reviewCount} />
        </View>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {p.destinations.map((d) => d.destination.name).join(' → ')}
        </Text>
        <View className="flex-row items-end justify-between">
          <View className="flex-row items-center gap-2">
            <Text variant="muted" className="text-xs">
              by {p.provider.businessName}
            </Text>
            <VerifiedBadge />
          </View>
          <View className="items-end">
            <Text className="font-bold text-primary">{money(p.pricePerPerson, { approxOnly: false }).split(' (')[0]}</Text>
            <Text variant="muted" className="text-[10px]">
              per person
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

export function VehicleCard({ v, onPress }: { v: Vehicle; onPress?: () => void }) {
  const money = useMoney();
  return (
    <Pressable onPress={onPress ?? (() => router.push(`/tourist/vehicle/${v.id}`))} className="flex-row overflow-hidden rounded-2xl border border-border bg-card active:opacity-80">
      <View className="w-28">
        <Cover uri={v.imageUrl} kind={v.vehicleType === 'bus' || v.vehicleType === 'minibus' ? 'bus' : 'vehicle'} iconSize={28} />
      </View>
      <View className="flex-1 gap-1 p-3">
        <Text className="font-bold">{v.makeModel}</Text>
        <Text variant="muted" className="text-xs">
          {titleCase(v.vehicleType)} · {v.seats} seats · {v.withDriver ? 'With driver' : 'Self-drive'} · {v.baseLocation}
        </Text>
        <Rating value={v.avgRating} count={v.reviewCount} />
        <View className="mt-1 flex-row items-end justify-between">
          <Text variant="muted" className="text-xs">
            {v.provider.businessName}
          </Text>
          {v.quote ? (
            <View className="items-end">
              <Text className="font-bold text-primary">{money(v.quote.total).split(' (')[0]}</Text>
              <Text variant="muted" className="text-[10px]">
                total for {v.quote.days} day{v.quote.days > 1 ? 's' : ''}, all-in
              </Text>
            </View>
          ) : (
            <View className="items-end">
              <Text className="font-bold text-primary">{money(v.pricePerDay).split(' (')[0]}</Text>
              <Text variant="muted" className="text-[10px]">
                per day
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export function ProductCard({ p }: { p: Product }) {
  const money = useMoney();
  return (
    <Pressable onPress={() => router.push(`/tourist/product/${p.id}`)} className="w-[48%] overflow-hidden rounded-2xl border border-border bg-card active:opacity-80">
      <View className="h-28">
        <Cover uri={p.imageUrls[0]} kind="product" />
      </View>
      <View className="gap-1 p-3">
        <Text className="text-sm font-semibold" numberOfLines={2}>
          {p.name}
        </Text>
        <Text variant="muted" className="text-xs" numberOfLines={1}>
          {p.vendor.shopName}
        </Text>
        <Text className="font-bold text-primary">{money(p.price).split(' (')[0]}</Text>
        {p.stockQty === 0 ? <Text className="text-xs text-destructive">Out of stock</Text> : null}
      </View>
    </Pressable>
  );
}
