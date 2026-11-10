import { View } from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { FlagIcon, MessageSquareWarningIcon, ShieldCheckIcon, UsersIcon, WalletIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { BarChart, ListRow, Row, Section, StatCard } from '@/components/app/bits';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { lkrText, titleCase } from '@/lib/format';
import { format, parseISO } from 'date-fns';

interface Analytics {
  users: Record<string, number>;
  pendingApplications: number;
  reportedReviews: number;
  openComplaints: number;
  bookingsByStatus: Record<string, number>;
  revenueByMonth: { month: string; bookings: number; marketplace: number }[];
  totalRevenue: number;
  topProviders: { id: number; businessName: string; avgRating: number; reviewCount: number }[];
  topProducts: { id: number; name: string; avgRating: number; reviewCount: number }[];
}

const compact = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));

export default function AdminDashboard() {
  const q = useQuery({ queryKey: ['admin', 'analytics'], queryFn: () => api.get<Analytics>('/admin/analytics') });
  const a = q.data;
  const totalUsers = a ? Object.values(a.users).reduce((s, n) => s + n, 0) : 0;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <QueryState query={q}>
        {a ? (
          <>
            <View className="flex-row flex-wrap gap-3">
              <StatCard label="Revenue (6 months)" value={lkrText(a.totalRevenue)} icon={WalletIcon} />
              <StatCard label="Active users" value={totalUsers} icon={UsersIcon} hint={Object.entries(a.users).map(([r, n]) => `${n} ${r}`).join(' · ')} />
            </View>
            <View className="gap-2">
              <ListRow icon={ShieldCheckIcon} title={`${a.pendingApplications} application(s) to verify`} subtitle="Providers and vendors waiting for approval" onPress={() => router.push('/admin/approvals')} />
              <ListRow icon={FlagIcon} title={`${a.reportedReviews} reported review(s)`} subtitle="Check and moderate" onPress={() => router.push('/admin/moderation')} />
              <ListRow icon={MessageSquareWarningIcon} title={`${a.openComplaints} open complaint(s)`} subtitle="Investigate and resolve" onPress={() => router.push('/admin/complaints')} />
            </View>
            <Section title="Revenue by month">
              <View className="rounded-xl border border-border p-4">
                <BarChart
                  format={compact}
                  data={a.revenueByMonth.map((m) => ({
                    label: format(parseISO(`${m.month}-01`), 'MMM'),
                    values: [
                      { value: m.marketplace, className: 'bg-amber-400' },
                      { value: m.bookings, className: 'bg-primary' },
                    ],
                  }))}
                />
                <View className="mt-3 flex-row justify-center gap-4">
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-3 w-3 rounded-sm bg-primary" />
                    <Text variant="muted" className="text-xs">
                      Bookings
                    </Text>
                  </View>
                  <View className="flex-row items-center gap-1.5">
                    <View className="h-3 w-3 rounded-sm bg-amber-400" />
                    <Text variant="muted" className="text-xs">
                      Marketplace
                    </Text>
                  </View>
                </View>
              </View>
            </Section>
            <Section title="Bookings by status">
              <View className="rounded-xl border border-border p-4">
                {Object.entries(a.bookingsByStatus).map(([s, n]) => (
                  <Row key={s} label={titleCase(s)} value={String(n)} />
                ))}
              </View>
            </Section>
            <Section title="Top-rated providers">
              <View className="rounded-xl border border-border p-4">
                {a.topProviders.length ? a.topProviders.map((p) => <Row key={p.id} label={p.businessName} value={`★ ${Number(p.avgRating).toFixed(1)} (${p.reviewCount})`} />) : <Text variant="muted">No reviews yet</Text>}
              </View>
            </Section>
            <Section title="Top-rated products">
              <View className="rounded-xl border border-border p-4">
                {a.topProducts.length ? a.topProducts.map((p) => <Row key={p.id} label={p.name} value={`★ ${Number(p.avgRating).toFixed(1)} (${p.reviewCount})`} />) : <Text variant="muted">No product reviews yet</Text>}
              </View>
            </Section>
          </>
        ) : null}
      </QueryState>
    </Screen>
  );
}
