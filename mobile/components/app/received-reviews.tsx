import { View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareReplyIcon, StarIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { ago } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Review } from '@/lib/types';

/** Reviews of the provider's or vendor's own listings, with a one-time public reply. */
export function ReceivedReviews() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const q = useQuery({ queryKey: ['reviews', 'received'], queryFn: () => api.get<{ items: Review[] }>('/reviews/received') });

  const reply = async (r: Review) => {
    const { ok, text } = await confirm({ title: 'Reply publicly', description: 'Your reply is shown under the review. You can reply once.', input: { placeholder: 'Thank you for visiting…', required: true }, confirmLabel: 'Post reply' });
    if (!ok || !text) return;
    try {
      await api.post(`/reviews/${r.id}/reply`, { reply: text });
      qc.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Reply posted');
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <QueryState query={q}>
      {q.data?.items.length ? (
        q.data.items.map((r) => (
          <View key={r.id} className="gap-2 rounded-2xl border border-border bg-card p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Icon key={n} as={StarIcon} size={14} className={n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'} />
                ))}
              </View>
              <View className="flex-row items-center gap-2">
                <StatusBadge status={r.targetType} plain />
                <Text variant="muted" className="text-xs">
                  {ago(r.createdAt)}
                </Text>
              </View>
            </View>
            {r.comment ? <Text>{r.comment}</Text> : <Text variant="muted">No comment</Text>}
            <Text variant="muted" className="text-xs">
              {r.tourist?.fullName}
            </Text>
            {r.providerReply ? (
              <View className="flex-row gap-2 rounded-lg bg-muted p-3">
                <Icon as={MessageSquareReplyIcon} className="text-muted-foreground" />
                <Text className="flex-1 text-sm">{r.providerReply}</Text>
              </View>
            ) : (
              <Button size="sm" variant="outline" className="self-start" onPress={() => reply(r)}>
                <Icon as={MessageSquareReplyIcon} />
                <Text>Reply</Text>
              </Button>
            )}
          </View>
        ))
      ) : (
        <EmptyView icon={StarIcon} title="No reviews yet" description="Only customers with a completed booking or delivered order can review you, so every review is genuine." />
      )}
    </QueryState>
  );
}
