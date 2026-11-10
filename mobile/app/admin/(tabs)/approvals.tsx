import * as React from 'react';
import { Linking, Pressable, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { CheckIcon, FileTextIcon, ShieldCheckIcon, XIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDate, titleCase } from '@/lib/format';
import { toast } from '@/lib/toast';

interface Application {
  kind: 'provider' | 'vendor';
  id: number;
  name: string;
  subtitle: string;
  licenceNo: string | null;
  description: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt: string;
  user: { fullName: string; email: string; phone: string | null; documents: { id: number; docType: string; fileUrl: string }[] };
}

export default function Approvals() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [status, setStatus] = React.useState('pending');
  const q = useQuery({ queryKey: ['admin', 'applications', status], queryFn: () => api.get<{ items: Application[] }>('/admin/applications', { status }) });
  const decide = useMutation({
    mutationFn: ({ a, decision, reason }: { a: Application; decision: 'approved' | 'rejected'; reason?: string }) => api.patch(`/admin/applications/${a.kind}/${a.id}`, { decision, reason }),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(v.decision === 'approved' ? `${v.a.name} approved` : `${v.a.name} rejected`, 'The applicant has been notified.');
    },
    onError: (e) => toast.error(e),
  });
  const reject = async (a: Application) => {
    const { ok, text } = await confirm({ title: `Reject ${a.name}?`, description: 'The reason is sent to the applicant so they can fix it.', input: { placeholder: 'Reason, e.g. licence photo is unreadable', required: true }, confirmLabel: 'Reject', destructive: true });
    if (ok) decide.mutate({ a, decision: 'rejected', reason: text });
  };

  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <ChipSelect options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' }]} value={status} onChange={setStatus} />
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((a) => (
            <View key={`${a.kind}-${a.id}`} className="gap-3 rounded-2xl border border-border bg-card p-4">
              <View className="flex-row items-start justify-between gap-2">
                <View className="flex-1">
                  <Text className="text-lg font-bold">{a.name}</Text>
                  <Text variant="muted" className="text-sm">
                    {titleCase(a.kind)} · {titleCase(a.subtitle)}
                  </Text>
                </View>
                <StatusBadge status={a.status} plain />
              </View>
              <View className="gap-0.5">
                <Text className="text-sm">
                  {a.user.fullName} · {a.user.email}
                  {a.user.phone ? ` · ${a.user.phone}` : ''}
                </Text>
                {a.licenceNo ? <Text className="text-sm font-semibold">Licence: {a.licenceNo}</Text> : null}
                {a.description ? <Text variant="muted" className="text-sm">{a.description}</Text> : null}
                <Text variant="muted" className="text-xs">
                  Submitted {fmtDate(a.submittedAt)}
                </Text>
                {a.rejectionReason ? <Text className="text-sm text-destructive">Reason: {a.rejectionReason}</Text> : null}
              </View>
              {a.user.documents.length ? (
                <View className="flex-row flex-wrap gap-2">
                  {a.user.documents.map((d) => (
                    <Pressable key={d.id} onPress={() => Linking.openURL(d.fileUrl)} className="items-center gap-1">
                      {/\.(jpg|jpeg|png|webp)$/i.test(d.fileUrl) ? (
                        <Image source={{ uri: d.fileUrl }} style={{ width: 72, height: 72, borderRadius: 8 }} contentFit="cover" />
                      ) : (
                        <View className="h-[72px] w-[72px] items-center justify-center rounded-lg bg-muted">
                          <Icon as={FileTextIcon} size={24} className="text-muted-foreground" />
                        </View>
                      )}
                      <Text variant="muted" className="text-[10px]">
                        {d.docType}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : (
                <Text variant="muted" className="text-xs">
                  No documents uploaded
                </Text>
              )}
              {a.status === 'pending' ? (
                <View className="flex-row gap-2">
                  <Button variant="outline" className="flex-1" onPress={() => reject(a)}>
                    <Icon as={XIcon} />
                    <Text>Reject</Text>
                  </Button>
                  <Button className="flex-1" onPress={() => decide.mutate({ a, decision: 'approved' })}>
                    <Icon as={CheckIcon} />
                    <Text>Approve</Text>
                  </Button>
                </View>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyView icon={ShieldCheckIcon} title={status === 'pending' ? 'No applications waiting' : `No ${status} applications`} />
        )}
      </QueryState>
    </Screen>
  );
}
