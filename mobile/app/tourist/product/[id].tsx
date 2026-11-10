import * as React from 'react';
import { ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { StoreIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover, Rating, VerifiedBadge } from '@/components/app/bits';
import { Stepper } from '@/components/app/form';
import { ReviewsList } from '@/components/app/reviews-list';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { useCart } from '@/lib/cart-store';
import { useMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Product } from '@/lib/types';

export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const money = useMoney();
  const add = useCart((s) => s.add);
  const inCart = useCart((s) => s.items.find((i) => i.productId === Number(id))?.quantity ?? 0);
  const [qty, setQty] = React.useState(1);
  const q = useQuery({ queryKey: ['product', id], queryFn: () => api.get<{ product: Product }>(`/market/products/${id}`) });
  const p = q.data?.product;
  const left = p ? p.stockQty - inCart : 0;

  const addToCart = () => {
    if (!p) return;
    add({ productId: p.id, name: p.name, price: Number(p.price), vendorId: p.vendor.id, vendorName: p.vendor.shopName, imageUrl: p.imageUrls[0] ?? null, stockQty: p.stockQty }, qty);
    toast.success('Added to cart', `${qty} × ${p.name}`);
  };

  return (
    <Screen
      footer={
        p ? (
          <View className="flex-row items-center gap-3">
            <Stepper value={qty} onChange={setQty} min={1} max={Math.max(1, left)} />
            <Button size="lg" className="flex-1" onPress={addToCart} disabled={left <= 0}>
              <Text>{left <= 0 ? (p.stockQty ? 'All stock in your cart' : 'Out of stock') : `Add · ${money(Number(p.price) * qty).split(' (')[0]}`}</Text>
            </Button>
          </View>
        ) : undefined
      }>
      <Stack.Screen options={{ title: p?.name ?? 'Product' }} />
      <QueryState query={q}>
        {p ? (
          <>
            {p.imageUrls.length ? (
              <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} className="h-56 rounded-2xl">
                {p.imageUrls.map((u) => (
                  <Image key={u} source={{ uri: u }} style={{ width: 340, height: 224, borderRadius: 16, marginRight: 8 }} contentFit="cover" />
                ))}
              </ScrollView>
            ) : (
              <View className="h-48 overflow-hidden rounded-2xl">
                <Cover kind="product" iconSize={56} />
              </View>
            )}
            <View className="gap-2">
              <Text variant="muted" className="text-xs uppercase tracking-wide">
                {p.category.name}
              </Text>
              <Text className="text-2xl font-bold">{p.name}</Text>
              <Text className="text-xl font-bold text-primary">{money(p.price)}</Text>
              <Rating value={p.avgRating} count={p.reviewCount} />
              <Text className="leading-6">{p.description}</Text>
              <Text variant="muted" className="text-sm">
                {p.stockQty > 0 ? `${p.stockQty} in stock` : 'Out of stock'}
              </Text>
            </View>
            <View className="flex-row items-center gap-3 rounded-xl border border-border p-4">
              <Icon as={StoreIcon} size={22} className="text-primary" />
              <View className="flex-1">
                <Text className="font-semibold">{p.vendor.shopName}</Text>
                <Text variant="muted" className="text-xs">
                  {p.vendor.district ?? 'Sri Lanka'}
                </Text>
                <Rating value={p.vendor.avgRating} count={p.vendor.reviewCount} />
              </View>
              <VerifiedBadge label="Verified artisan" />
            </View>
            <Button variant="link" onPress={() => router.push('/tourist/cart')}>
              <Text>Go to cart{inCart ? ` (${inCart} of this item)` : ''}</Text>
            </Button>
            <ReviewsList targetType="product" targetId={p.id} avg={p.avgRating} count={p.reviewCount} />
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
