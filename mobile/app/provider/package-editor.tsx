import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { Screen } from '@/components/app/screen';
import { Section } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { Field, Stepper } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { LoadingView } from '@/components/app/states';
import { ApiError, api } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { Destination, Paged, TourPackage } from '@/lib/types';

const lines = (s: string) => s.split(/\n|,/).map((x) => x.trim()).filter(Boolean);

export default function PackageEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const existing = useQuery({ queryKey: ['provider-packages'], queryFn: () => api.get<{ items: TourPackage[] }>('/provider/packages'), enabled: !!id });
  const pkg = existing.data?.items.find((p) => p.id === Number(id));

  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [days, setDays] = React.useState(1);
  const [price, setPrice] = React.useState('');
  const [group, setGroup] = React.useState(10);
  const [inc, setInc] = React.useState('');
  const [exc, setExc] = React.useState('');
  const [policy, setPolicy] = React.useState('Free cancellation up to 48 hours before the start date.');
  const [image, setImage] = React.useState<string[]>([]);
  const [active, setActive] = React.useState(true);
  const [itinerary, setItinerary] = React.useState<{ destination: Pick<Destination, 'id' | 'name' | 'district'>; dayNo: number }[]>([]);
  const [picker, setPicker] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const dests = useQuery({ queryKey: ['destinations', 'picker', search], queryFn: () => api.get<Paged<Destination>>('/destinations', { q: search, limit: 50 }), enabled: picker });

  React.useEffect(() => {
    if (!pkg) return;
    setTitle(pkg.title);
    setDescription(pkg.description);
    setDays(pkg.durationDays);
    setPrice(String(pkg.pricePerPerson));
    setGroup(pkg.maxGroupSize);
    setInc(pkg.inclusions.join('\n'));
    setExc(pkg.exclusions.join('\n'));
    setPolicy(pkg.cancellationPolicy ?? '');
    setImage(pkg.imageUrl ? [pkg.imageUrl] : []);
    setActive(pkg.isActive);
    setItinerary(pkg.destinations.map((d) => ({ destination: d.destination, dayNo: d.dayNo })));
  }, [pkg]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        title,
        description,
        durationDays: days,
        pricePerPerson: Number(price),
        maxGroupSize: group,
        inclusions: lines(inc),
        exclusions: lines(exc),
        cancellationPolicy: policy || undefined,
        imageUrl: image[0] ?? null,
        isActive: active,
        itinerary: itinerary.map((i) => ({ destinationId: i.destination.id, dayNo: Math.min(i.dayNo, days) })),
      };
      return id ? api.put(`/provider/packages/${id}`, body) : api.post('/provider/packages', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider-packages'] });
      toast.success(id ? 'Package updated' : 'Package published', 'Tourists can now find it.');
      router.back();
    },
    onError: (e) => {
      const details = e instanceof ApiError && e.details ? Object.values(e.details as Record<string, string[]>).flat().join(' ') : undefined;
      toast.error(details ? new Error(details) : e, 'Please check the form');
    },
  });

  const remove = async () => {
    const { ok } = await confirm({ title: 'Remove this package?', description: 'Packages with bookings are hidden instead of deleted.', destructive: true, confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await api.del(`/provider/packages/${id}`);
      qc.invalidateQueries({ queryKey: ['provider-packages'] });
      router.back();
    } catch (e) {
      toast.error(e);
    }
  };

  if (id && existing.isLoading) return <LoadingView rows={4} />;
  const valid = title.trim().length >= 3 && description.trim().length >= 10 && Number(price) > 0 && itinerary.length > 0;

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => save.mutate()} disabled={!valid || save.isPending}>
          <Text>{save.isPending ? 'Saving…' : id ? 'Save changes' : 'Publish package'}</Text>
        </Button>
      }>
      <Stack.Screen
        options={{
          title: id ? 'Edit package' : 'New package',
          headerRight: id
            ? () => (
                <Button variant="ghost" size="icon" onPress={remove} accessibilityLabel="Remove package">
                  <Icon as={Trash2Icon} className="text-destructive" />
                </Button>
              )
            : undefined,
        }}
      />
      <Field label="Cover photo">
        <ImageUpload value={image} onChange={setImage} max={1} />
      </Field>
      <Field label="Title">
        <Input value={title} onChangeText={setTitle} placeholder="e.g. Cultural Triangle Explorer" />
      </Field>
      <Field label="Description" hint="At least 10 characters">
        <Textarea value={description} onChangeText={setDescription} />
      </Field>
      <View className="flex-row gap-4">
        <Field label="Days" className="flex-1">
          <Stepper value={days} onChange={setDays} min={1} max={30} />
        </Field>
        <Field label="Max group" className="flex-1">
          <Stepper value={group} onChange={setGroup} min={1} max={100} />
        </Field>
      </View>
      <Field label="Price per person (LKR)">
        <Input value={price} onChangeText={(t) => setPrice(t.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" placeholder="e.g. 25000" />
      </Field>

      <Section
        title="Itinerary"
        action={
          <Button size="sm" variant="outline" onPress={() => setPicker(true)}>
            <Icon as={PlusIcon} />
            <Text>Add place</Text>
          </Button>
        }>
        {!itinerary.length ? <Text variant="muted">Add at least one destination and the day it is visited.</Text> : null}
        {itinerary.map((it, i) => (
          <View key={it.destination.id} className="flex-row items-center gap-3 rounded-xl border border-border p-3">
            <View className="flex-1">
              <Text className="font-medium">{it.destination.name}</Text>
              <Text variant="muted" className="text-xs">
                {it.destination.district}
              </Text>
            </View>
            <Text variant="muted" className="text-xs">
              Day
            </Text>
            <Stepper value={Math.min(it.dayNo, days)} onChange={(n) => setItinerary(itinerary.map((x, j) => (j === i ? { ...x, dayNo: n } : x)))} min={1} max={days} />
            <Button variant="ghost" size="icon" onPress={() => setItinerary(itinerary.filter((_, j) => j !== i))} accessibilityLabel="Remove">
              <Icon as={XIcon} />
            </Button>
          </View>
        ))}
      </Section>

      <Field label="What's included" hint="One per line">
        <Textarea value={inc} onChangeText={setInc} placeholder={'Air-conditioned transport\nEnglish-speaking guide'} />
      </Field>
      <Field label="Not included" hint="One per line – be transparent about extra costs">
        <Textarea value={exc} onChangeText={setExc} placeholder={'Entrance tickets\nTips'} />
      </Field>
      <Field label="Cancellation policy">
        <Input value={policy} onChangeText={setPolicy} />
      </Field>
      <View className="flex-row items-center justify-between rounded-xl border border-border p-4">
        <View className="flex-1">
          <Text className="font-medium">Visible to tourists</Text>
          <Text variant="muted" className="text-xs">
            Turn off to pause new bookings
          </Text>
        </View>
        <Switch checked={active} onCheckedChange={setActive} />
      </View>

      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="w-[380px] max-w-full">
          <DialogHeader>
            <DialogTitle>Add a destination</DialogTitle>
          </DialogHeader>
          <Input value={search} onChangeText={setSearch} placeholder="Search" autoFocus />
          <ScrollView style={{ maxHeight: 360 }}>
            {dests.data?.items
              .filter((d) => !itinerary.some((i) => i.destination.id === d.id))
              .map((d) => (
                <Pressable
                  key={d.id}
                  onPress={() => {
                    setItinerary([...itinerary, { destination: d, dayNo: Math.min(days, (itinerary.at(-1)?.dayNo ?? 1)) }]);
                    setPicker(false);
                  }}
                  className="border-b border-border py-3 active:bg-accent">
                  <Text className="font-medium">{d.name}</Text>
                  <Text variant="muted" className="text-xs">
                    {d.district}
                  </Text>
                </Pressable>
              ))}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
