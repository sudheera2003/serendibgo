import * as React from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2Icon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect, Field } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { LoadingView } from '@/components/app/states';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Category, Product } from '@/lib/types';

export default function ProductEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/market/categories') });
  const existing = useQuery({ queryKey: ['vendor-products'], queryFn: () => api.get<{ items: Product[] }>('/vendor/products'), enabled: !!id });
  const p = existing.data?.items.find((x) => x.id === Number(id));

  const [categoryId, setCategoryId] = React.useState<number>();
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [price, setPrice] = React.useState('');
  const [stock, setStock] = React.useState('');
  const [images, setImages] = React.useState<string[]>([]);
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (!p) return;
    setCategoryId(p.categoryId);
    setName(p.name);
    setDescription(p.description);
    setPrice(String(p.price));
    setStock(String(p.stockQty));
    setImages(p.imageUrls);
    setActive(p.isActive);
  }, [p]);

  const save = useMutation({
    mutationFn: () => {
      const body = { categoryId, name, description, price: Number(price), stockQty: Number(stock || 0), imageUrls: images, isActive: active };
      return id ? api.put(`/vendor/products/${id}`, body) : api.post('/vendor/products', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
      toast.success(id ? 'Product updated' : 'Product added');
      router.back();
    },
    onError: (e) => toast.error(e, 'Please check the form'),
  });

  const remove = async () => {
    const { ok } = await confirm({ title: 'Remove this product?', description: 'Products that were ordered are hidden instead of deleted.', destructive: true, confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await api.del(`/vendor/products/${id}`);
      qc.invalidateQueries({ queryKey: ['vendor-products'] });
      router.back();
    } catch (e) {
      toast.error(e);
    }
  };

  if (id && existing.isLoading) return <LoadingView rows={4} />;
  const valid = !!categoryId && name.trim().length >= 2 && description.trim().length >= 10 && Number(price) > 0 && stock !== '';

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => save.mutate()} disabled={!valid || save.isPending}>
          <Text>{save.isPending ? 'Saving…' : id ? 'Save changes' : 'Add product'}</Text>
        </Button>
      }>
      <Stack.Screen
        options={{
          title: id ? 'Edit product' : 'New product',
          headerRight: id
            ? () => (
                <Button variant="ghost" size="icon" onPress={remove} accessibilityLabel="Remove product">
                  <Icon as={Trash2Icon} className="text-destructive" />
                </Button>
              )
            : undefined,
        }}
      />
      <Field label="Photos (up to 6)">
        <ImageUpload value={images} onChange={setImages} max={6} />
      </Field>
      <Field label="Category">
        <ChipSelect options={(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))} value={categoryId} onChange={setCategoryId} scroll={false} />
      </Field>
      <Field label="Product name">
        <Input value={name} onChangeText={setName} placeholder="e.g. True Ceylon Cinnamon Sticks (200 g)" />
      </Field>
      <Field label="Description" hint="At least 10 characters – mention size, materials and origin">
        <Textarea value={description} onChangeText={setDescription} />
      </Field>
      <View className="flex-row gap-3">
        <Field label="Price (LKR)" className="flex-1">
          <Input value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
        </Field>
        <Field label="In stock" className="flex-1">
          <Input value={stock} onChangeText={(t) => setStock(t.replace(/\D/g, ''))} keyboardType="number-pad" />
        </Field>
      </View>
      <View className="flex-row items-center justify-between rounded-xl border border-border p-4">
        <Text className="font-medium">Visible in the market</Text>
        <Switch checked={active} onCheckedChange={setActive} />
      </View>
    </Screen>
  );
}
