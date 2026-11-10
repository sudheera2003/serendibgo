import * as React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BuildingIcon, StoreIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/app/screen';
import { Row } from '@/components/app/bits';
import { Field } from '@/components/app/form';
import { ApiError, api } from '@/lib/api';
import { cartTotal, useCart } from '@/lib/cart-store';
import { lkrText, useMoney } from '@/lib/format';
import { pay } from '@/lib/pay';
import { toast } from '@/lib/toast';
import type { Order } from '@/lib/types';

export default function Checkout() {
  const { items, clear } = useCart();
  const qc = useQueryClient();
  const money = useMoney();
  const [delivery, setDelivery] = React.useState<'hotel' | 'pickup'>('hotel');
  const [hotel, setHotel] = React.useState('');
  const [address, setAddress] = React.useState('');
  const total = cartTotal(items);
  const valid = delivery === 'pickup' || (hotel.trim().length > 1 && address.trim().length > 3);

  const place = useMutation({
    mutationFn: () =>
      api.post<{ order: Order }>('/market/orders', {
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        deliveryType: delivery,
        hotelName: delivery === 'hotel' ? hotel : undefined,
        deliveryAddress: delivery === 'hotel' ? address : undefined,
      }),
    onSuccess: async ({ order }) => {
      clear();
      qc.invalidateQueries({ queryKey: ['orders'] });
      router.replace(`/tourist/order/${order.id}`);
      try {
        await pay({ orderId: order.id });
      } catch (e) {
        toast.error(e, 'Payment could not start');
      }
    },
    onError: (e) => {
      toast.error(e, e instanceof ApiError && e.status === 409 ? 'Not enough stock' : 'Could not place the order');
    },
  });

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => place.mutate()} disabled={!valid || place.isPending || !items.length}>
          <Text>{place.isPending ? 'Placing order…' : `Place order & pay ${lkrText(total)}`}</Text>
        </Button>
      }>
      <Card>
        <CardHeader>
          <CardTitle>How would you like to receive it?</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <RadioGroup value={delivery} onValueChange={(v) => setDelivery(v as 'hotel' | 'pickup')} className="gap-3">
            <View className="flex-row items-center gap-3">
              <RadioGroupItem value="hotel" aria-labelledby="hotel" />
              <Icon as={BuildingIcon} className="text-primary" />
              <Text nativeID="hotel" onPress={() => setDelivery('hotel')} className="flex-1">
                Deliver to my hotel
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <RadioGroupItem value="pickup" aria-labelledby="pickup" />
              <Icon as={StoreIcon} className="text-primary" />
              <Text nativeID="pickup" onPress={() => setDelivery('pickup')} className="flex-1">
                Pick up from the artisan
              </Text>
            </View>
          </RadioGroup>
          {delivery === 'hotel' ? (
            <View className="gap-3">
              <Field label="Hotel name">
                <Input value={hotel} onChangeText={setHotel} placeholder="e.g. Cinnamon Citadel Kandy" />
              </Field>
              <Field label="Hotel address">
                <Input value={address} onChangeText={setAddress} placeholder="Street and town" />
              </Field>
            </View>
          ) : (
            <Text variant="muted" className="text-sm">
              The artisans will notify you when your items are ready to collect.
            </Text>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Order summary</CardTitle>
        </CardHeader>
        <CardContent className="gap-1">
          {items.map((i) => (
            <Row key={i.productId} label={`${i.quantity} × ${i.name}`} value={lkrText(i.price * i.quantity)} />
          ))}
          <Row label="Delivery" value="Free" />
          <Separator className="my-2" />
          <Row label="Total" value={money(total)} bold />
          <Text variant="muted" className="mt-2 text-xs">
            You will pay securely with PayHere. SerendibGO never sees or stores your card details.
          </Text>
        </CardContent>
      </Card>
    </Screen>
  );
}
