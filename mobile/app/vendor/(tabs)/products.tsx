import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BoxesIcon, PlusIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, Rating, StatusBadge } from '@/components/app/bits';
import { EmptyView, QueryState } from '@/components/app/states';
import { VerificationBanner } from '@/components/app/verification-banner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { lkrText } from '@/lib/format';
import type { Product } from '@/lib/types';
import { cn } from '@/lib/utils';

export default function VendorProducts() {
  const shop = useAuth((s) => s.user?.vendorProfile);
  const q = useQuery({ queryKey: ['vendor-products'], queryFn: () => api.get<{ items: Product[] }>('/vendor/products'), enabled: !!shop });
  return (
    <Screen
      refreshing={q.isRefetching}
      onRefresh={q.refetch}
      footer={
        shop?.verificationStatus === 'approved' ? (
          <Button size="lg" onPress={() => router.push('/vendor/product-editor')}>
            <Icon as={PlusIcon} />
            <Text>Add a product</Text>
          </Button>
        ) : undefined
      }>
      <VerificationBanner status={shop?.verificationStatus} reason={shop?.rejectionReason} applyPath="/vendor/application" kind="vendor" />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((p) => (
            <Pressable key={p.id} onPress={() => router.push({ pathname: '/vendor/product-editor', params: { id: String(p.id) } })} className="flex-row gap-3 rounded-2xl border border-border bg-card p-3 active:bg-accent">
              <View className="h-20 w-20 overflow-hidden rounded-xl">
                <Cover uri={p.imageUrls[0]} kind="product" iconSize={22} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-semibold">{p.name}</Text>
                <Text variant="muted" className="text-xs">
                  {p.category.name} · {lkrText(p.price)}
                </Text>
                <Text className={cn('text-xs font-semibold', p.stockQty <= 5 ? 'text-destructive' : 'text-muted-foreground')}>{p.stockQty} in stock{p.stockQty <= 5 ? ' – low' : ''}</Text>
                <View className="flex-row items-center gap-2">
                  <StatusBadge status={p.isActive ? 'visible' : 'hidden'} plain />
                  <Rating value={p.avgRating} count={p.reviewCount} />
                </View>
              </View>
            </Pressable>
          ))
        ) : (
          <EmptyView icon={BoxesIcon} title="No products yet" description="Add your spices, tea or crafts with a clear photo and price." />
        )}
      </QueryState>
    </Screen>
  );
}
