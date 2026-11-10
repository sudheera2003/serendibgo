import * as React from 'react';
import { View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { ChipSelect, Field } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { RouteMap } from '@/components/app/route-map';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Destination } from '@/lib/types';

const CATEGORIES = ['heritage', 'religious', 'nature', 'wildlife', 'hill_country', 'tea', 'scenic', 'beach'].map((c) => ({ value: c, label: c.replace('_', ' ') }));
const PROVINCES = ['Western', 'Central', 'Southern', 'Northern', 'Eastern', 'North Western', 'North Central', 'Uva', 'Sabaragamuwa'].map((p) => ({ value: p, label: p }));

export default function DestinationEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const all = useQuery({ queryKey: ['admin', 'destinations'], queryFn: () => api.get<{ items: Destination[] }>('/admin/destinations'), enabled: !!id });
  const d = all.data?.items.find((x) => x.id === Number(id));

  const [name, setName] = React.useState('');
  const [category, setCategory] = React.useState('heritage');
  const [province, setProvince] = React.useState('Central');
  const [district, setDistrict] = React.useState('');
  const [lat, setLat] = React.useState('');
  const [lng, setLng] = React.useState('');
  const [fee, setFee] = React.useState('0');
  const [description, setDescription] = React.useState('');
  const [image, setImage] = React.useState<string[]>([]);
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (!d) return;
    setName(d.name);
    setCategory(d.category);
    setProvince(d.province);
    setDistrict(d.district);
    setLat(String(d.latitude));
    setLng(String(d.longitude));
    setFee(String(d.entryFee));
    setDescription(d.description ?? '');
    setImage(d.imageUrl ? [d.imageUrl] : []);
    setActive(d.isActive);
  }, [d]);

  const save = useMutation({
    mutationFn: () => {
      const body = { name, category, province, district, latitude: Number(lat), longitude: Number(lng), entryFee: Number(fee || 0), description: description || undefined, imageUrl: image[0] ?? null, isActive: active };
      return id ? api.put(`/admin/destinations/${id}`, body) : api.post('/admin/destinations', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'destinations'] });
      qc.invalidateQueries({ queryKey: ['destinations'] });
      toast.success('Destination saved');
      router.back();
    },
    onError: (e) => toast.error(e, 'Please check the form'),
  });

  const latN = Number(lat);
  const lngN = Number(lng);
  const coordsOk = latN >= 5.5 && latN <= 10 && lngN >= 79.4 && lngN <= 82;
  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => save.mutate()} disabled={!name || !district || !coordsOk || save.isPending}>
          <Text>{id ? 'Save changes' : 'Add destination'}</Text>
        </Button>
      }>
      <Stack.Screen options={{ title: id ? 'Edit destination' : 'New destination' }} />
      <Field label="Photo">
        <ImageUpload value={image} onChange={setImage} />
      </Field>
      <Field label="Name">
        <Input value={name} onChangeText={setName} />
      </Field>
      <Field label="Category">
        <ChipSelect options={CATEGORIES} value={category} onChange={setCategory} scroll={false} />
      </Field>
      <Field label="Province">
        <ChipSelect options={PROVINCES} value={province} onChange={setProvince} />
      </Field>
      <Field label="District">
        <Input value={district} onChangeText={setDistrict} />
      </Field>
      <View className="flex-row gap-3">
        <Field label="Latitude" className="flex-1" error={lat && !coordsOk ? 'Must be inside Sri Lanka' : undefined}>
          <Input value={lat} onChangeText={setLat} keyboardType="decimal-pad" placeholder="7.9570" />
        </Field>
        <Field label="Longitude" className="flex-1">
          <Input value={lng} onChangeText={setLng} keyboardType="decimal-pad" placeholder="80.7603" />
        </Field>
      </View>
      {coordsOk ? <RouteMap points={[{ lat: latN, lng: lngN, title: name || 'Destination' }]} height={160} /> : null}
      <Field label="Entrance fee (LKR, foreign visitor)">
        <Input value={fee} onChangeText={(t) => setFee(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" />
      </Field>
      <Field label="Description">
        <Textarea value={description} onChangeText={setDescription} />
      </Field>
      <View className="flex-row items-center justify-between rounded-xl border border-border p-4">
        <Text className="font-medium">Visible to tourists</Text>
        <Switch checked={active} onCheckedChange={setActive} />
      </View>
    </Screen>
  );
}
