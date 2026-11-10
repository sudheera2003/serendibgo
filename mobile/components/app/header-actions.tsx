import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { BellIcon, ShoppingBagIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { cartCount, useCart } from '@/lib/cart-store';

function Dot({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View className="absolute -right-1 -top-1 h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1">
      <Text className="text-[10px] font-bold text-white">{n > 9 ? '9+' : n}</Text>
    </View>
  );
}

export function NotificationBell() {
  const { data } = useQuery({ queryKey: ['notifications', 'unread'], queryFn: () => api.get<{ unread: number }>('/notifications/unread-count'), refetchInterval: 30_000 });
  return (
    <Pressable onPress={() => router.push('/notifications')} className="p-2" accessibilityLabel="Notifications" hitSlop={8}>
      <Icon as={BellIcon} size={22} />
      <Dot n={data?.unread ?? 0} />
    </Pressable>
  );
}

export function CartButton() {
  const count = useCart((s) => cartCount(s.items));
  return (
    <Pressable onPress={() => router.push('/tourist/cart')} className="p-2" accessibilityLabel="Cart" hitSlop={8}>
      <Icon as={ShoppingBagIcon} size={22} />
      <Dot n={count} />
    </Pressable>
  );
}

export function HeaderRight({ cart }: { cart?: boolean }) {
  return (
    <View className="flex-row items-center gap-1 pr-2">
      {cart ? <CartButton /> : null}
      <NotificationBell />
    </View>
  );
}
