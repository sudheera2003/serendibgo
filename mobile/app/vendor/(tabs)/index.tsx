import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { PackageCheckIcon, ShoppingCartIcon, StarIcon, WalletIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Row, Section, StatCard } from '@/components/app/bits';
import { VerificationBanner } from '@/components/app/verification-banner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { lkrText } from '@/lib/format';
import { refreshMe } from '@/lib/session';

interface Sales {
  revenue: number;
  itemsSold: number;
  pendingFulfilment: number;
  topProducts: { name: string; quantity: number; revenue: number }[];
}

export default function VendorDashboard() {
  const user = useAuth((s) => s.user)!;
  const shop = user.vendorProfile;
  const me = useQuery({ queryKey: ['me'], queryFn: refreshMe });
  const sales = useQuery({ queryKey: ['vendor-sales'], queryFn: () => api.get<Sales>('/vendor/sales'), enabled: !!shop });

  return (
    <Screen refreshing={sales.isRefetching} onRefresh={() => Promise.all([sales.refetch(), me.refetch()])}>
      <View className="gap-1">
        <Text className="text-2xl font-bold">{shop?.shopName ?? user.fullName}</Text>
        <Text variant="muted">Sell directly to tourists – no middlemen.</Text>
      </View>
      <VerificationBanner status={shop?.verificationStatus} reason={shop?.rejectionReason} applyPath="/vendor/application" kind="vendor" />
      {shop && sales.data ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <StatCard label="Revenue" value={lkrText(sales.data.revenue)} icon={WalletIcon} hint="Paid orders" />
            <StatCard label="Items sold" value={sales.data.itemsSold} icon={ShoppingCartIcon} />
            <StatCard label="To fulfil" value={sales.data.pendingFulfilment} icon={PackageCheckIcon} />
            <StatCard label="Shop rating" value={shop.reviewCount ? `★ ${Number(shop.avgRating).toFixed(1)}` : '—'} icon={StarIcon} hint={`${shop.reviewCount} verified reviews`} />
          </View>
          {sales.data.pendingFulfilment ? (
            <Button size="lg" onPress={() => router.push('/vendor/orders')}>
              <Text>Fulfil {sales.data.pendingFulfilment} order item(s)</Text>
            </Button>
          ) : null}
          <Section title="Best sellers">
            {sales.data.topProducts.length ? (
              <View className="rounded-xl border border-border p-4">
                {sales.data.topProducts.map((p) => (
                  <Row key={p.name} label={`${p.name} (${p.quantity} sold)`} value={lkrText(p.revenue)} />
                ))}
              </View>
            ) : (
              <Text variant="muted">Your sales will appear here once customers pay for orders.</Text>
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}
