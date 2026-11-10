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
import { Screen } from '@/components/app/screen';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect, Field, Stepper } from '@/components/app/form';
import { ImageUpload } from '@/components/app/image-upload';
import { LoadingView } from '@/components/app/states';
import { api } from '@/lib/api';
import { lkrText } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Vehicle } from '@/lib/types';

const TYPES = [
  { value: 'car', label: 'Car' },
  { value: 'van', label: 'Van' },
  { value: 'suv', label: 'SUV' },
  { value: 'tuk_tuk', label: 'Tuk-tuk' },
  { value: 'motorbike', label: 'Scooter' },
  { value: 'minibus', label: 'Minibus' },
  { value: 'bus', label: 'Bus' },
];
const num = (s: string) => s.replace(/[^0-9.]/g, '');

export default function VehicleEditor() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const existing = useQuery({ queryKey: ['provider-vehicles'], queryFn: () => api.get<{ items: Vehicle[] }>('/provider/vehicles'), enabled: !!id });
  const v = existing.data?.items.find((x) => x.id === Number(id));

  const [type, setType] = React.useState('car');
  const [makeModel, setMakeModel] = React.useState('');
  const [seats, setSeats] = React.useState(4);
  const [withDriver, setWithDriver] = React.useState(true);
  const [perDay, setPerDay] = React.useState('');
  const [perKm, setPerKm] = React.useState('0');
  const [driverFee, setDriverFee] = React.useState('0');
  const [location, setLocation] = React.useState('');
  const [image, setImage] = React.useState<string[]>([]);
  const [active, setActive] = React.useState(true);

  React.useEffect(() => {
    if (!v) return;
    setType(v.vehicleType);
    setMakeModel(v.makeModel);
    setSeats(v.seats);
    setWithDriver(v.withDriver);
    setPerDay(String(v.pricePerDay));
    setPerKm(String(v.pricePerKm));
    setDriverFee(String(v.driverFeePerDay));
    setLocation(v.baseLocation);
    setImage(v.imageUrl ? [v.imageUrl] : []);
    setActive(v.isActive);
  }, [v]);

  const save = useMutation({
    mutationFn: () => {
      const body = {
        vehicleType: type,
        makeModel,
        seats,
        withDriver,
        pricePerDay: Number(perDay),
        pricePerKm: Number(perKm || 0),
        driverFeePerDay: withDriver ? Number(driverFee || 0) : 0,
        baseLocation: location,
        imageUrl: image[0] ?? null,
        isActive: active,
      };
      return id ? api.put(`/provider/vehicles/${id}`, body) : api.post('/provider/vehicles', body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['provider-vehicles'] });
      toast.success(id ? 'Vehicle updated' : 'Vehicle listed');
      router.back();
    },
    onError: (e) => toast.error(e, 'Please check the form'),
  });

  const remove = async () => {
    const { ok } = await confirm({ title: 'Remove this vehicle?', description: 'Vehicles with bookings are hidden instead of deleted.', destructive: true, confirmLabel: 'Remove' });
    if (!ok) return;
    try {
      await api.del(`/provider/vehicles/${id}`);
      qc.invalidateQueries({ queryKey: ['provider-vehicles'] });
      router.back();
    } catch (e) {
      toast.error(e);
    }
  };

  if (id && existing.isLoading) return <LoadingView rows={4} />;
  const valid = makeModel.trim().length >= 2 && Number(perDay) > 0 && location.trim().length >= 2;
  const example = Number(perDay || 0) * 3 + Number(perKm || 0) * 200 + (withDriver ? Number(driverFee || 0) * 3 : 0);

  return (
    <Screen
      footer={
        <Button size="lg" onPress={() => save.mutate()} disabled={!valid || save.isPending}>
          <Text>{save.isPending ? 'Saving…' : id ? 'Save changes' : 'List vehicle'}</Text>
        </Button>
      }>
      <Stack.Screen
        options={{
          title: id ? 'Edit vehicle' : 'New vehicle',
          headerRight: id
            ? () => (
                <Button variant="ghost" size="icon" onPress={remove} accessibilityLabel="Remove vehicle">
                  <Icon as={Trash2Icon} className="text-destructive" />
                </Button>
              )
            : undefined,
        }}
      />
      <Field label="Photo">
        <ImageUpload value={image} onChange={setImage} max={1} />
      </Field>
      <Field label="Type">
        <ChipSelect options={TYPES} value={type} onChange={setType} scroll={false} />
      </Field>
      <Field label="Make and model">
        <Input value={makeModel} onChangeText={setMakeModel} placeholder="e.g. Toyota Prius" />
      </Field>
      <View className="flex-row gap-4">
        <Field label="Seats" className="flex-1">
          <Stepper value={seats} onChange={setSeats} min={1} max={60} />
        </Field>
        <Field label="Pickup town" className="flex-1">
          <Input value={location} onChangeText={setLocation} placeholder="e.g. Kandy" />
        </Field>
      </View>
      <View className="flex-row items-center justify-between rounded-xl border border-border p-4">
        <Text className="font-medium">Comes with a driver</Text>
        <Switch checked={withDriver} onCheckedChange={setWithDriver} />
      </View>
      <View className="flex-row gap-3">
        <Field label="Per day (LKR)" className="flex-1">
          <Input value={perDay} onChangeText={(t) => setPerDay(num(t))} keyboardType="decimal-pad" />
        </Field>
        <Field label="Per km (LKR)" className="flex-1">
          <Input value={perKm} onChangeText={(t) => setPerKm(num(t))} keyboardType="decimal-pad" />
        </Field>
        {withDriver ? (
          <Field label="Driver / day" className="flex-1">
            <Input value={driverFee} onChangeText={(t) => setDriverFee(num(t))} keyboardType="decimal-pad" />
          </Field>
        ) : null}
      </View>
      <Text variant="muted" className="text-sm">
        Example shown to tourists: 3 days and 200 km = {lkrText(example)}, with every line itemised.
      </Text>
      <View className="flex-row items-center justify-between rounded-xl border border-border p-4">
        <Text className="font-medium">Available for booking</Text>
        <Switch checked={active} onCheckedChange={setActive} />
      </View>
    </Screen>
  );
}
