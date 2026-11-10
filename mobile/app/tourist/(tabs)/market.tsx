import * as React from 'react';
import { View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { HandHeartIcon, PackageSearchIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { ProductCard } from '@/components/app/cards';
import { ChipSelect } from '@/components/app/form';
import { EmptyView, QueryState } from '@/components/app/states';
import { api } from '@/lib/api';
import type { Category, Paged, Product } from '@/lib/types';

const SORTS = [
  { value: 'rating', label: 'Top rated' },
  { value: 'price_asc', label: 'Price ↑' },
  { value: 'price_desc', label: 'Price ↓' },
  { value: 'newest', label: 'Newest' },
];

export default function Market() {
  const [q, setQ] = React.useState('');
  const [debounced, setDebounced] = React.useState('');
  const [categoryId, setCategoryId] = React.useState<number>(0);
  const [sort, setSort] = React.useState('rating');
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 350);
    return () => clearTimeout(t);
  }, [q]);

  const cats = useQuery({ queryKey: ['categories'], queryFn: () => api.get<{ items: Category[] }>('/market/categories') });
  const products = useQuery({
    queryKey: ['products', debounced, categoryId, sort],
    queryFn: () => api.get<Paged<Product>>('/market/products', { q: debounced, categoryId: categoryId || undefined, sort, limit: 40 }),
  });

  return (
    <Screen refreshing={products.isRefetching} onRefresh={products.refetch}>
      <View className="flex-row items-center gap-3 rounded-2xl bg-accent p-4">
        <Icon as={HandHeartIcon} size={26} className="text-primary" />
        <Text className="flex-1 text-sm">Buy directly from verified Sri Lankan artisans. Delivered to your hotel or ready for pickup.</Text>
      </View>
      <Input value={q} onChangeText={setQ} placeholder="Search spices, tea, crafts…" />
      <ChipSelect options={[{ value: 0, label: 'All' }, ...(cats.data?.items ?? []).map((c) => ({ value: c.id, label: c.name }))]} value={categoryId} onChange={setCategoryId} />
      <ChipSelect options={SORTS} value={sort} onChange={setSort} />
      <QueryState query={products}>
        {products.data?.items.length ? (
          <View className="flex-row flex-wrap justify-between gap-y-3">
            {products.data.items.map((p) => (
              <ProductCard key={p.id} p={p} />
            ))}
          </View>
        ) : (
          <EmptyView icon={PackageSearchIcon} title="No products found" description="Try another search or category." />
        )}
      </QueryState>
    </Screen>
  );
}
