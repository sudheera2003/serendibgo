import * as React from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect } from '@/components/app/form';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { fmtDate } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Paged } from '@/lib/types';

interface Row {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: 'active' | 'suspended';
  createdAt: string;
}

export default function Users() {
  const me = useAuth((s) => s.user?.id);
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [q, setQ] = React.useState('');
  const [role, setRole] = React.useState('');
  const query = useQuery({ queryKey: ['admin', 'users', q, role], queryFn: () => api.get<Paged<Row>>('/admin/users', { q: q || undefined, role: role || undefined, limit: 50 }) });
  const set = useMutation({
    mutationFn: ({ id, status }: { id: number; status: 'active' | 'suspended' }) => api.patch(`/admin/users/${id}/status`, { status }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      toast.success('Account updated');
    },
    onError: (e) => toast.error(e),
  });
  const toggle = async (u: Row) => {
    const suspend = u.status === 'active';
    const { ok } = await confirm({ title: `${suspend ? 'Suspend' : 'Reactivate'} ${u.fullName}?`, description: suspend ? 'They will be logged out and cannot sign in until reactivated.' : undefined, destructive: suspend, confirmLabel: suspend ? 'Suspend' : 'Reactivate' });
    if (ok) set.mutate({ id: u.id, status: suspend ? 'suspended' : 'active' });
  };
  return (
    <Screen refreshing={query.isRefetching} onRefresh={query.refetch}>
      <Input value={q} onChangeText={setQ} placeholder="Search name or e-mail" autoCapitalize="none" />
      <ChipSelect
        options={[
          { value: '', label: 'All roles' },
          { value: 'tourist', label: 'Tourists' },
          { value: 'provider', label: 'Providers' },
          { value: 'vendor', label: 'Vendors' },
          { value: 'admin', label: 'Admins' },
        ]}
        value={role}
        onChange={setRole}
      />
      <QueryState query={query}>
        {query.data?.items.map((u) => (
          <View key={u.id} className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
            <View className="flex-1 gap-0.5">
              <Text className="font-semibold">{u.fullName}</Text>
              <Text variant="muted" className="text-xs">
                {u.email} · joined {fmtDate(u.createdAt)}
              </Text>
              <View className="flex-row gap-2">
                <StatusBadge status={u.role} plain />
                {u.status === 'suspended' ? <StatusBadge status="cancelled" plain /> : null}
              </View>
            </View>
            {u.id !== me ? (
              <Button size="sm" variant={u.status === 'active' ? 'outline' : 'default'} onPress={() => toggle(u)}>
                <Text>{u.status === 'active' ? 'Suspend' : 'Reactivate'}</Text>
              </Button>
            ) : null}
          </View>
        ))}
        <Text variant="muted" className="text-center text-xs">
          {query.data?.total ?? 0} account(s)
        </Text>
      </QueryState>
    </Screen>
  );
}
