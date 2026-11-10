import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { FlagIcon, MessageSquareReplyIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { Rating, Section, VerifiedBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { ago } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Paged, Review } from '@/lib/types';
import { StarIcon } from 'lucide-react-native';

type Data = Paged<Review> & { distribution: { rating: number; count: number }[] };

export function ReviewsList({ targetType, targetId, avg, count }: { targetType: Review['targetType']; targetId: number; avg: number; count: number }) {
  const confirm = useConfirm();
  const signedIn = useAuth((s) => s.status === 'signedIn');
  const q = useQuery({ queryKey: ['reviews', targetType, targetId], queryFn: () => api.get<Data>('/reviews', { targetType, targetId, limit: 20 }) });

  const report = async (r: Review) => {
    const { ok, text } = await confirm({ title: 'Report this review?', description: 'Tell us what is wrong. An administrator will check it.', input: { placeholder: 'Reason (e.g. offensive language)', required: true }, confirmLabel: 'Report' });
    if (!ok) return;
    try {
      await api.post(`/reviews/${r.id}/report`, { reason: text });
      toast.success('Thanks for reporting');
    } catch (e) {
      toast.error(e);
    }
  };

  const total = q.data?.total ?? 0;
  return (
    <Section title="Verified reviews" action={<Rating value={avg} count={count} size="md" />}>
      <View className="flex-row items-center gap-2 rounded-lg bg-accent p-3">
        <VerifiedBadge label="Verified only" />
        <Text variant="muted" className="flex-1 text-xs">
          Every review comes from a completed booking, a delivered order or a GPS-verified visit.
        </Text>
      </View>
      {total ? (
        <View className="gap-1">
          {q.data!.distribution.map((d) => (
            <View key={d.rating} className="flex-row items-center gap-2">
              <View className="w-6 flex-row items-center gap-0.5">
                <Text className="text-xs">{d.rating}</Text>
                <Icon as={StarIcon} size={10} className="fill-amber-400 text-amber-400" />
              </View>
              <Progress value={(d.count / total) * 100} className="h-1.5 flex-1" />
              <Text variant="muted" className="w-6 text-right text-xs">
                {d.count}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
      {q.data?.items.map((r) => (
        <View key={r.id} className="gap-2 rounded-xl border border-border p-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Icon key={n} as={StarIcon} size={14} className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
              ))}
            </View>
            <Text variant="muted" className="text-xs">
              {ago(r.createdAt)}
            </Text>
          </View>
          {r.comment ? <Text>{r.comment}</Text> : null}
          <Text variant="muted" className="text-xs">
            {r.tourist?.fullName ?? 'Traveller'}
          </Text>
          {r.providerReply ? (
            <View className="flex-row gap-2 rounded-lg bg-muted p-3">
              <Icon as={MessageSquareReplyIcon} className="text-muted-foreground" />
              <Text variant="muted" className="flex-1 text-sm">
                {r.providerReply}
              </Text>
            </View>
          ) : null}
          {signedIn ? (
            <Button variant="ghost" size="sm" className="self-start" onPress={() => report(r)}>
              <Icon as={FlagIcon} className="text-muted-foreground" />
              <Text className="text-muted-foreground">Report</Text>
            </Button>
          ) : null}
        </View>
      ))}
      {q.data && !q.data.items.length ? <Text variant="muted">No reviews yet. Be the first after your visit!</Text> : null}
    </Section>
  );
}
