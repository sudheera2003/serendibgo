import * as React from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageSquareWarningIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDateTime, titleCase } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Complaint } from '@/lib/types';

export default function AdminComplaints() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = React.useState('open');
  const q = useQuery({ queryKey: ['admin', 'complaints', status], queryFn: () => api.get<{ items: Complaint[] }>('/admin/complaints', { status: status || undefined }) });
  const update = useMutation({
    mutationFn: ({ id, to, note }: { id: number; to: string; note?: string }) => api.patch(`/admin/complaints/${id}`, { status: to, resolutionNote: note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success('Complaint updated', 'The tourist has been notified.');
    },
    onError: (e) => toast.error(e),
  });
  const close = async (c: Complaint, to: 'resolved' | 'rejected') => {
    const { ok, text } = await confirm({ title: to === 'resolved' ? 'Resolve complaint' : 'Reject complaint', description: 'Your note is shared with the tourist.', input: { placeholder: 'What was done?', required: true }, confirmLabel: to === 'resolved' ? 'Resolve' : 'Reject' });
    if (ok) update.mutate({ id: c.id, to, note: text });
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ChipSelect
        options={[
          { value: 'open', label: 'Open' },
          { value: 'in_progress', label: 'In progress' },
          { value: 'resolved', label: 'Resolved' },
          { value: 'rejected', label: 'Rejected' },
          { value: '', label: 'All' },
        ]}
        value={status}
        onChange={setStatus}
      />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((c) => (
            <View key={c.id} className="gap-2 rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-start justify-between gap-2">
                <Text className="flex-1 font-semibold">{c.subject}</Text>
                <StatusBadge status={c.status} plain />
              </View>
              <Text>{c.description}</Text>
              <Text variant="muted" className="text-xs">
                {c.tourist?.fullName} ({c.tourist?.email}) · about {titleCase(c.targetType)}
                {c.targetId ? ` #${c.targetId}` : ''} · {fmtDateTime(c.createdAt)}
              </Text>
              {c.resolutionNote ? (
                <View className="rounded-lg bg-accent p-3">
                  <Text className="text-sm">{c.resolutionNote}</Text>
                  {c.resolvedBy ? <Text variant="muted" className="text-xs">— {c.resolvedBy.fullName}</Text> : null}
                </View>
              ) : null}
              {c.status === 'open' || c.status === 'in_progress' ? (
                <View className="flex-row flex-wrap gap-2">
                  {c.status === 'open' ? (
                    <Button variant="outline" size="sm" onPress={() => update.mutate({ id: c.id, to: 'in_progress' })}>
                      <Text>Start investigating</Text>
                    </Button>
                  ) : null}
                  <Button variant="outline" size="sm" onPress={() => close(c, 'rejected')}>
                    <Text>Reject</Text>
                  </Button>
                  <Button size="sm" onPress={() => close(c, 'resolved')}>
                    <Text>Resolve</Text>
                  </Button>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyView icon={MessageSquareWarningIcon} title="No complaints here" />
        )}
      </QueryState>
    </Screen>
  );
}
