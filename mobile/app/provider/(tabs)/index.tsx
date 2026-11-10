import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClockIcon, CheckIcon, InboxIcon, StarIcon, WalletIcon, XIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Section, StatCard } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { EmptyView } from '@/components/app/states';
import { VerificationBanner } from '@/components/app/verification-banner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtDate, lkrText } from '@/lib/format';
import { refreshMe } from '@/lib/session';
import { toast } from '@/lib/toast';
import type { Booking, Paged } from '@/lib/types';

export default function ProviderDashboard() {
  const user = useAuth((s) => s.user)!;
  const profile = user.providerProfile;
  const qc = useQueryClient();
  const confirm = useConfirm();
  const me = useQuery({ queryKey: ['me'], queryFn: refreshMe });
  const bookings = useQuery({ queryKey: ['provider-bookings', 'all'], queryFn: () => api.get<Paged<Booking>>('/bookings/incoming', { limit: 50 }), enabled: !!profile });

  const items = bookings.data?.items ?? [];
  const pending = items.filter((b) => b.status === 'pending');
  const upcoming = items.filter((b) => b.status === 'confirmed' && new Date(b.endDate) >= new Date());
  const earned = items.filter((b) => b.status === 'confirmed' || b.status === 'completed').reduce((s, b) => s + Number(b.totalAmount), 0);

  const decide = useMutation({
    mutationFn: ({ id, status, reason }: { id: number; status: 'accepted' | 'declined'; reason?: string }) => api.patch(`/bookings/${id}/status`, { status, reason }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['provider-bookings'] });
      toast.success(v.status === 'accepted' ? 'Booking accepted' : 'Booking declined', v.status === 'accepted' ? 'The tourist has been asked to pay.' : undefined);
    },
    onError: (e) => toast.error(e),
  });
  const decline = async (b: Booking) => {
    const { ok, text } = await confirm({ title: 'Decline this request?', input: { placeholder: 'Reason (optional, shared with the tourist)' }, confirmLabel: 'Decline', destructive: true });
    if (ok) decide.mutate({ id: b.id, status: 'declined', reason: text });
  };

  return (
    <Screen refreshing={bookings.isRefetching || me.isRefetching} onRefresh={() => Promise.all([bookings.refetch(), me.refetch()])}>
      <View className="gap-1">
        <Text className="text-2xl font-bold">{profile?.businessName ?? user.fullName}</Text>
        <Text variant="muted">Manage your requests, listings and reputation.</Text>
      </View>
      <VerificationBanner status={profile?.verificationStatus} reason={profile?.rejectionReason} applyPath="/provider/application" kind="provider" />
      {profile ? (
        <>
          <View className="flex-row flex-wrap gap-3">
            <StatCard label="New requests" value={pending.length} icon={InboxIcon} />
            <StatCard label="Upcoming" value={upcoming.length} icon={CalendarClockIcon} />
            <StatCard label="Trust score" value={profile.reviewCount ? `★ ${Number(profile.avgRating).toFixed(1)}` : '—'} icon={StarIcon} hint={`${profile.reviewCount} verified reviews`} />
            <StatCard label="Booked value" value={lkrText(earned)} icon={WalletIcon} hint="Paid & completed" />
          </View>
          <Section title="Waiting for your answer">
            {pending.length ? (
              pending.map((b) => (
                <View key={b.id} className="gap-3 rounded-2xl border border-border bg-card p-4">
                  <View className="gap-1">
                    <Text className="font-semibold">{b.package?.title ?? b.vehicle?.makeModel}</Text>
                    <Text variant="muted" className="text-sm">
                      {b.tourist.fullName} · {fmtDate(b.startDate)}
                      {b.bookingType === 'package' ? ` · ${b.numPersons} people` : ` → ${fmtDate(b.endDate)}`} · {lkrText(b.totalAmount)}
                    </Text>
                    {b.notes ? <Text className="text-sm">“{b.notes}”</Text> : null}
                  </View>
                  <View className="flex-row gap-2">
                    <Button variant="outline" className="flex-1" onPress={() => decline(b)}>
                      <Icon as={XIcon} />
                      <Text>Decline</Text>
                    </Button>
                    <Button className="flex-1" onPress={() => decide.mutate({ id: b.id, status: 'accepted' })}>
                      <Icon as={CheckIcon} />
                      <Text>Accept</Text>
                    </Button>
                  </View>
                </View>
              ))
            ) : (
              <EmptyView icon={InboxIcon} title="You're all caught up" description="New booking requests will appear here and as notifications." />
            )}
          </Section>
          {upcoming.length ? (
            <Section title="Upcoming confirmed bookings">
              {upcoming.slice(0, 5).map((b) => (
                <Button key={b.id} variant="outline" className="h-auto justify-start py-3" onPress={() => router.push(`/provider/booking/${b.id}`)}>
                  <View className="flex-1">
                    <Text className="font-semibold">{b.package?.title ?? b.vehicle?.makeModel}</Text>
                    <Text variant="muted" className="text-xs">
                      {fmtDate(b.startDate)} · {b.tourist.fullName}
                    </Text>
                  </View>
                </Button>
              ))}
            </Section>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
