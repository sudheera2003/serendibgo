import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Location from 'expo-location';
import { ArrowDownIcon, ArrowUpIcon, CarIcon, PlusIcon, SparklesIcon, Trash2Icon, XIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Row, Section } from '@/components/app/bits';
import { PackageCard } from '@/components/app/cards';
import { useConfirm } from '@/components/app/confirm';
import { ChipSelect, DateField, Field } from '@/components/app/form';
import { RouteMap } from '@/components/app/route-map';
import { LoadingView } from '@/components/app/states';
import { api } from '@/lib/api';
import { duration, isoDay, lkrText, titleCase, useMoney } from '@/lib/format';
import { toast } from '@/lib/toast';
import type { Destination, Paged, QuoteLine, TourPackage, Trip } from '@/lib/types';

type StartKind = 'none' | 'here' | 'airport' | 'colombo';
interface Start {
  lat: number;
  lng: number;
  label: string;
}
const PRESETS: Record<'airport' | 'colombo', Start> = {
  airport: { lat: 7.1808, lng: 79.8841, label: 'Bandaranaike Airport' },
  colombo: { lat: 6.9271, lng: 79.8612, label: 'Colombo' },
};
interface TripResponse {
  trip: Trip;
  costBreakdown: QuoteLine[];
  optimisation?: { changed: boolean; beforeKm?: number; afterKm?: number; savedKm: number; message?: string };
}

export default function TripPlanner() {
  const { id, add } = useLocalSearchParams<{ id: string; add?: string }>();
  const isNew = id === 'new';
  const qc = useQueryClient();
  const money = useMoney();
  const confirm = useConfirm();

  const [title, setTitle] = React.useState('My Sri Lanka trip');
  const [startDate, setStartDate] = React.useState<Date | undefined>();
  const [endDate, setEndDate] = React.useState<Date | undefined>();
  const [startKind, setStartKind] = React.useState<StartKind>('airport');
  const [avoidHighways, setAvoidHighways] = React.useState(false);
  const [start, setStart] = React.useState<Start | null>(PRESETS.airport);
  const [stops, setStops] = React.useState<Destination[]>([]);
  const [dirty, setDirty] = React.useState(isNew);
  const [picker, setPicker] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const q = useQuery({ queryKey: ['trip', id], queryFn: () => api.get<TripResponse>(`/trips/${id}`), enabled: !isNew });
  const suggestions = useQuery({ queryKey: ['trip', id, 'suggestions'], queryFn: () => api.get<{ packages: TourPackage[] }>(`/trips/${id}/suggestions`), enabled: !isNew });
  const dests = useQuery({ queryKey: ['destinations', 'picker', search], queryFn: () => api.get<Paged<Destination>>('/destinations', { q: search, limit: 50 }), enabled: picker });
  const preset = useQuery({ queryKey: ['destination', add], queryFn: () => api.get<{ destination: Destination }>(`/destinations/${add}`), enabled: isNew && !!add });

  // Load the saved trip into the editor.
  const loadTrip = React.useCallback((t: Trip) => {
    setTitle(t.title);
    setStartDate(t.startDate ? new Date(t.startDate) : undefined);
    setEndDate(t.endDate ? new Date(t.endDate) : undefined);
    if (t.startLat != null && t.startLng != null) {
      const s = { lat: Number(t.startLat), lng: Number(t.startLng), label: t.startLabel ?? 'Start' };
      setStart(s);
      setStartKind(s.label === PRESETS.airport.label ? 'airport' : s.label === PRESETS.colombo.label ? 'colombo' : 'here');
    } else {
      setStart(null);
      setStartKind('none');
    }
    setStops(t.stops.map((s) => s.destination));
    setAvoidHighways(!!t.avoidHighways);
    setDirty(false);
  }, []);
  React.useEffect(() => {
    if (q.data?.trip) loadTrip(q.data.trip);
  }, [q.data?.trip, loadTrip]);
  React.useEffect(() => {
    if (preset.data?.destination) setStops((s) => (s.some((d) => d.id === preset.data!.destination.id) ? s : [...s, preset.data!.destination]));
  }, [preset.data]);

  const change = <T,>(fn: (v: T) => void) => (v: T) => {
    fn(v);
    setDirty(true);
  };

  const chooseStart = async (kind: StartKind) => {
    setStartKind(kind);
    setDirty(true);
    if (kind === 'none') return setStart(null);
    if (kind === 'airport' || kind === 'colombo') return setStart(PRESETS[kind]);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) throw new Error('Location permission was not granted');
      const pos = await Location.getCurrentPositionAsync({});
      const { latitude: lat, longitude: lng } = pos.coords;
      if (lat < 5.8 || lat > 10 || lng < 79.4 || lng > 82) {
        toast.info('You seem to be outside Sri Lanka', 'Using Bandaranaike Airport as the start instead.');
        setStartKind('airport');
        return setStart(PRESETS.airport);
      }
      setStart({ lat, lng, label: 'My location' });
    } catch (e) {
      toast.error(e, 'Could not get your location');
      setStartKind('airport');
      setStart(PRESETS.airport);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    const next = [...stops];
    [next[i], next[i + dir]] = [next[i + dir], next[i]];
    change(setStops)(next);
  };

  const body = () => ({
    title: title.trim() || 'My trip',
    startDate: startDate ? isoDay(startDate) : undefined,
    endDate: endDate ? isoDay(endDate) : undefined,
    start: start,
    avoidHighways,
    destinationIds: stops.map((s) => s.id),
  });

  const save = useMutation({
    mutationFn: () => (isNew ? api.post<TripResponse>('/trips', body()) : api.patch<TripResponse>(`/trips/${id}`, body())),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['trips'] });
      qc.setQueryData(['trip', String(res.trip.id)], res);
      toast.success('Trip saved', `${Number(res.trip.totalDistanceKm).toFixed(0)} km · ${duration(res.trip.totalDurationMin)} of driving`);
      if (isNew) router.replace(`/tourist/trip/${res.trip.id}`);
      else loadTrip(res.trip);
    },
    onError: (e) => toast.error(e, 'Could not save the trip'),
  });

  const optimise = useMutation({
    mutationFn: () => api.post<TripResponse>(`/trips/${id}/optimise`),
    onSuccess: (res) => {
      qc.setQueryData(['trip', id], res);
      qc.invalidateQueries({ queryKey: ['trips'] });
      loadTrip(res.trip);
      const o = res.optimisation!;
      if (o.changed) toast.success('Route optimised', `New order saves about ${o.savedKm.toFixed(0)} km (${o.beforeKm?.toFixed(0)} → ${o.afterKm?.toFixed(0)} km).`);
      else toast.info('Already efficient', o.message ?? 'Your current order is already the shortest we found.');
    },
    onError: (e) => toast.error(e),
  });

  const remove = async () => {
    const { ok } = await confirm({ title: 'Delete this trip?', destructive: true, confirmLabel: 'Delete' });
    if (!ok) return;
    await api.del(`/trips/${id}`);
    qc.invalidateQueries({ queryKey: ['trips'] });
    router.back();
  };

  if (!isNew && q.isLoading) return <LoadingView rows={4} />;
  const saved = q.data?.trip;
  const showLegs = !dirty && saved;
  const points = [...(start ? [{ lat: start.lat, lng: start.lng, title: start.label, kind: 'start' as const }] : []), ...stops.map((s) => ({ lat: Number(s.latitude), lng: Number(s.longitude), title: s.name }))];

  return (
    <Screen
      footer={
        <View className="flex-row gap-2">
          {!isNew && !dirty && stops.length >= 3 ? (
            <Button variant="outline" className="flex-1" onPress={() => optimise.mutate()} disabled={optimise.isPending}>
              <Icon as={SparklesIcon} />
              <Text>{optimise.isPending ? 'Optimising…' : 'Optimise order'}</Text>
            </Button>
          ) : null}
          <Button className="flex-1" onPress={() => save.mutate()} disabled={save.isPending || (!dirty && !isNew)}>
            <Text>{save.isPending ? 'Calculating…' : isNew ? 'Save & calculate' : dirty ? 'Save & recalculate' : 'Saved'}</Text>
          </Button>
        </View>
      }>
      <Stack.Screen options={{ title: isNew ? 'New trip' : 'Trip planner', headerRight: !isNew ? () => <Button variant="ghost" size="icon" onPress={remove} accessibilityLabel="Delete trip"><Icon as={Trash2Icon} className="text-destructive" /></Button> : undefined }} />
      <Field label="Trip name">
        <Input value={title} onChangeText={change(setTitle)} />
      </Field>
      <View className="flex-row gap-3">
        <View className="flex-1">
          <DateField label="From (optional)" value={startDate} onChange={change(setStartDate)} minDate={new Date()} />
        </View>
        <View className="flex-1">
          <DateField label="To (optional)" value={endDate} onChange={change(setEndDate)} minDate={startDate ?? new Date()} />
        </View>
      </View>
      <Field label="Starting point">
        <ChipSelect
          options={[
            { value: 'airport', label: 'Airport (BIA)' },
            { value: 'colombo', label: 'Colombo' },
            { value: 'here', label: 'My location' },
            { value: 'none', label: 'First stop' },
          ]}
          value={startKind}
          onChange={chooseStart}
        />
      </Field>

      <Field label="Route" hint={avoidHighways ? 'Uses normal A and B roads – slower, but more scenic and no tolls.' : 'Uses expressways (E01, E03…) where they are faster.'}>
        <ChipSelect
          options={[
            { value: 'fast', label: 'Fastest (use expressways)' },
            { value: 'avoid', label: 'Avoid expressways' },
          ]}
          value={avoidHighways ? 'avoid' : 'fast'}
          onChange={(v) => change(setAvoidHighways)(v === 'avoid')}
        />
      </Field>

      <RouteMap points={points} path={!dirty ? saved?.routeGeometry : null} hint="Save to see the route along the roads" />

      <Section
        title={`Stops (${stops.length}/10)`}
        action={
          <Button size="sm" variant="outline" onPress={() => setPicker(true)} disabled={stops.length >= 10}>
            <Icon as={PlusIcon} />
            <Text>Add stop</Text>
          </Button>
        }>
        {!stops.length ? <Text variant="muted">Add destinations to build your route.</Text> : null}
        {stops.map((s, i) => {
          const leg = showLegs ? saved!.stops[i] : undefined;
          return (
            <View key={s.id} className="gap-1">
              {leg && (i > 0 || start) ? (
                <Text variant="muted" className="pl-11 text-xs">
                  ↓ {Number(leg.legDistanceKm).toFixed(0)} km · {duration(leg.legDurationMin)}
                </Text>
              ) : null}
              <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-3">
                <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                  <Text className="text-xs font-bold text-primary-foreground">{i + 1}</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-semibold" numberOfLines={1}>
                    {s.name}
                  </Text>
                  <Text variant="muted" className="text-xs">
                    {s.district} · {titleCase(s.category)}
                  </Text>
                </View>
                <Button variant="ghost" size="icon" disabled={i === 0} onPress={() => move(i, -1)} accessibilityLabel="Move up">
                  <Icon as={ArrowUpIcon} />
                </Button>
                <Button variant="ghost" size="icon" disabled={i === stops.length - 1} onPress={() => move(i, 1)} accessibilityLabel="Move down">
                  <Icon as={ArrowDownIcon} />
                </Button>
                <Button variant="ghost" size="icon" onPress={() => change(setStops)(stops.filter((x) => x.id !== s.id))} accessibilityLabel="Remove stop">
                  <Icon as={XIcon} className="text-muted-foreground" />
                </Button>
              </View>
            </View>
          );
        })}
      </Section>

      {showLegs ? (
        <Card>
          <CardHeader>
            <CardTitle>Trip summary</CardTitle>
          </CardHeader>
          <CardContent className="gap-1">
            <Row label="Total distance" value={`${Number(saved!.totalDistanceKm).toFixed(1)} km`} />
            <Row label="Driving time" value={duration(saved!.totalDurationMin)} />
            {q.data?.costBreakdown.map((l) => <Row key={l.label} label={l.label} value={lkrText(l.amount)} />)}
            <Separator className="my-2" />
            <Row label="Estimated cost" value={money(saved!.estimatedCost)} bold />
            <Text variant="muted" className="mt-1 text-xs">
              {saved!.avoidHighways ? 'Avoiding expressways. ' : 'Expressways allowed. '}
              Distances: {
                {
                  google: 'Google Maps road network',
                  ors: 'OpenRouteService road network',
                  osrm: 'OpenStreetMap road network (OSRM)',
                  valhalla: 'OpenStreetMap road network (Valhalla)',
                  estimate: 'estimated from map coordinates (road routing was unavailable)',
                }[saved!.distanceSource]
              }.
            </Text>
            <Button variant="outline" className="mt-3" onPress={() => router.push({ pathname: '/tourist/vehicles', params: { km: String(Math.round(Number(saved!.totalDistanceKm))) } })}>
              <Icon as={CarIcon} />
              <Text>Rent a vehicle for this trip</Text>
            </Button>
          </CardContent>
        </Card>
      ) : stops.length ? (
        <Text variant="muted" className="text-center text-sm">
          Save to calculate distances, travel time and cost.
        </Text>
      ) : null}

      {suggestions.data?.packages.length ? (
        <Section title="Tours covering your stops">
          {suggestions.data.packages.slice(0, 3).map((p) => (
            <PackageCard key={p.id} p={p} />
          ))}
        </Section>
      ) : null}

      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent className="max-h-[80%] w-[380px] max-w-full">
          <DialogHeader>
            <DialogTitle>Add a destination</DialogTitle>
          </DialogHeader>
          <Input value={search} onChangeText={setSearch} placeholder="Search places or districts" autoFocus />
          <ScrollView style={{ maxHeight: 380 }}>
            {dests.data?.items.map((d) => {
              const added = stops.some((s) => s.id === d.id);
              return (
                <Pressable
                  key={d.id}
                  disabled={added}
                  onPress={() => {
                    change(setStops)([...stops, d]);
                    setPicker(false);
                    setSearch('');
                  }}
                  className="flex-row items-center justify-between border-b border-border py-3 active:bg-accent">
                  <View className="flex-1">
                    <Text className="font-medium">{d.name}</Text>
                    <Text variant="muted" className="text-xs">
                      {d.district} · {titleCase(d.category)}
                    </Text>
                  </View>
                  <Text className={added ? 'text-xs text-muted-foreground' : 'text-sm font-semibold text-primary'}>{added ? 'Added' : 'Add'}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </DialogContent>
      </Dialog>
    </Screen>
  );
}
