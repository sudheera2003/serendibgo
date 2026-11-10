import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { HistoryIcon } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { fmtDateTime } from '@/lib/format';
import type { Paged } from '@/lib/types';

interface Log {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: { fullName: string };
}

export default function AuditLogs() {
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => api.get<Paged<Log>>('/admin/audit-logs', { limit: 50 }) });
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <QueryState query={q}>
        {q.data?.items.length ? (
          q.data.items.map((l) => (
            <View key={l.id} className="gap-1 rounded-xl border border-border bg-card p-3">
              <Text className="font-mono text-sm font-semibold">{l.action}</Text>
              <Text variant="muted" className="text-xs">
                {l.entityType}
                {l.entityId ? ` #${l.entityId}` : ''} · {l.actor.fullName} · {fmtDateTime(l.createdAt)}
              </Text>
              {l.details && Object.values(l.details).some(Boolean) ? (
                <Text variant="muted" className="text-xs">
                  {Object.entries(l.details)
                    .filter(([, v]) => v)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(' · ')}
                </Text>
              ) : null}
            </View>
          ))
        ) : (
          <EmptyView icon={HistoryIcon} title="No admin actions yet" />
        )}
      </QueryState>
    </Screen>
  );
}
