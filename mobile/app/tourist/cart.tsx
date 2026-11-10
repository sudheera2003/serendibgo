import { View } from 'react-native';
import { router } from 'expo-router';
import { ShoppingBagIcon, StoreIcon, Trash2Icon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Cover } from '@/components/app/bits';
import { Stepper } from '@/components/app/form';
import { EmptyView } from '@/components/app/states';
import { cartTotal, useCart } from '@/lib/cart-store';
import { lkrText, useMoney } from '@/lib/format';

export default function Cart() {
  const { items, setQty, remove } = useCart();
  const money = useMoney();
  const vendors = [...new Map(items.map((i) => [i.vendorId, i.vendorName])).entries()];
  const total = cartTotal(items);

  if (!items.length) {
    return (
      <Screen>
        <EmptyView icon={ShoppingBagIcon} title="Your cart is empty" description="Find authentic spices, tea and crafts from verified artisans." action={<Button onPress={() => router.replace('/tourist/market')}><Text>Browse the market</Text></Button>} />
      </Screen>
    );
  }

  return (
    <Screen
      footer={
        <View className="gap-2">
          <View className="flex-row justify-between">
            <Text className="font-semibold">Total</Text>
            <Text className="font-bold">{money(total)}</Text>
          </View>
          <Button size="lg" onPress={() => router.push('/tourist/checkout')}>
            <Text>Checkout</Text>
          </Button>
        </View>
      }>
      <Text variant="muted" className="text-sm">
        Items from {vendors.length} artisan{vendors.length > 1 ? 's' : ''}. You pay once; each artisan prepares their own part of the order.
      </Text>
      {vendors.map(([vendorId, vendorName]) => (
        <View key={vendorId} className="gap-2 rounded-2xl border border-border p-3">
          <View className="flex-row items-center gap-2">
            <Icon as={StoreIcon} className="text-primary" />
            <Text className="font-semibold">{vendorName}</Text>
          </View>
          {items
            .filter((i) => i.vendorId === vendorId)
            .map((i) => (
              <View key={i.productId} className="flex-row items-center gap-3 border-t border-border pt-2">
                <View className="h-14 w-14 overflow-hidden rounded-lg">
                  <Cover uri={i.imageUrl} kind="product" iconSize={18} />
                </View>
                <View className="flex-1 gap-1">
                  <Text className="text-sm font-medium" numberOfLines={2}>
                    {i.name}
                  </Text>
                  <Text className="text-sm font-semibold">{lkrText(i.price * i.quantity)}</Text>
                </View>
                <View className="items-end gap-1">
                  <Stepper value={i.quantity} onChange={(n) => setQty(i.productId, n)} max={i.stockQty} />
                  <Button variant="ghost" size="sm" onPress={() => remove(i.productId)}>
                    <Icon as={Trash2Icon} className="text-muted-foreground" />
                    <Text className="text-muted-foreground">Remove</Text>
                  </Button>
                </View>
              </View>
            ))}
        </View>
      ))}
    </Screen>
  );
}
