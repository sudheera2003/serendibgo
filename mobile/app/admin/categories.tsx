import * as React from 'react';
import { View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { useConfirm } from '@/components/app/confirm';
import { ListRow, Section } from '@/components/app/bits';
import { QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Category } from '@/lib/types';

export default function Categories() {
  const qc = useQueryClient();
  const confirm = useConfirm();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const q = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/market/categories') });
  const create = useMutation({
    mutationFn: () => api.post('/admin/categories', { name, description: description || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['categories'] });
      setName('');
      setDescription('');
      toast.success('Category added');
    },
    onError: (e) => toast.error(e),
  });
  const rename = async (c: Category) => {
    const { ok, text } = await confirm({ title: `Rename "${c.name}"`, input: { placeholder: 'New name', required: true }, confirmLabel: 'Save' });
    if (!ok || !text) return;
    try {
      await api.put(`/admin/categories/${c.id}`, { name: text, description: c.description ?? undefined });
      qc.invalidateQueries({ queryKey: ['categories'] });
      toast.success('Category renamed');
    } catch (e) {
      toast.error(e);
    }
  };
  return (
    <Screen refreshing={q.isRefetching} onRefresh={q.refetch}>
      <Section title="Add a category">
        <View className="gap-2">
          <Input value={name} onChangeText={setName} placeholder="Name, e.g. Gemstones" />
          <Input value={description} onChangeText={setDescription} placeholder="Short description (optional)" />
          <Button onPress={() => create.mutate()} disabled={name.trim().length < 2 || create.isPending}>
            <Text>Add category</Text>
          </Button>
        </View>
      </Section>
      <Section title="Categories">
        <QueryState query={q}>
          {q.data?.items.map((c) => (
            <ListRow key={c.id} title={c.name} subtitle={`${c._count?.products ?? 0} live products${c.description ? ` · ${c.description}` : ''}`} onPress={() => rename(c)} />
          ))}
        </QueryState>
      </Section>
    </Screen>
  );
}
