import * as React from 'react';
import { View } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import { useThemeMode } from '@/lib/theme-pref';
import { Text } from '@/components/ui/text';

export interface MapPoint {
  lat: number;
  lng: number;
  title: string;
  kind?: 'start' | 'stop';
}

/**
 * Native map with numbered stops. When `path` (the real road geometry from the API) is given,
 * the route is drawn along the roads; otherwise only the stops are shown.
 */
export function RouteMap({ points, path, height = 260, hint }: { points: MapPoint[]; path?: [number, number][] | null; height?: number; hint?: string }) {
  const ref = React.useRef<MapView>(null);
  const colorScheme = useThemeMode((s) => s.mode);
  const coords = points.map((p) => ({ latitude: Number(p.lat), longitude: Number(p.lng) }));
  const road = React.useMemo(() => (path ?? []).map(([lat, lng]) => ({ latitude: lat, longitude: lng })), [path]);

  React.useEffect(() => {
    const fit = road.length > 1 ? [...coords, ...road.filter((_, i) => i % 20 === 0)] : coords;
    if (fit.length) {
      const t = setTimeout(() => ref.current?.fitToCoordinates(fit, { edgePadding: { top: 40, bottom: 40, left: 40, right: 40 }, animated: true }), 300);
      return () => clearTimeout(t);
    }
  }, [JSON.stringify(coords), road.length]);

  if (!coords.length) {
    return (
      <View className="items-center justify-center rounded-xl bg-muted" style={{ height }}>
        <Text variant="muted">Add stops to see your route</Text>
      </View>
    );
  }
  let n = 0;
  return (
    <View className="overflow-hidden rounded-xl border border-border" style={{ height }}>
      <MapView
        ref={ref}
        provider={PROVIDER_DEFAULT}
        style={{ flex: 1 }}
        userInterfaceStyle={colorScheme === 'dark' ? 'dark' : 'light'}
        initialRegion={{ latitude: 7.8731, longitude: 80.7718, latitudeDelta: 4, longitudeDelta: 4 }}>
        {points.map((p, i) => {
          const label = p.kind === 'start' ? 'S' : String(++n);
          return (
            <Marker key={`${i}-${p.title}`} coordinate={coords[i]} title={p.title}>
              <View className={p.kind === 'start' ? 'h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-800' : 'h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-teal-700'}>
                <Text className="text-xs font-bold text-white">{label}</Text>
              </View>
            </Marker>
          );
        })}
        {road.length > 1 ? <Polyline coordinates={road} strokeColor="#0F766E" strokeWidth={4} /> : null}
      </MapView>
      {coords.length > 1 && road.length < 2 && hint ? (
        <View className="absolute bottom-2 left-2 right-2 items-center">
          <Text className="rounded-full bg-background/90 px-3 py-1 text-xs">{hint}</Text>
        </View>
      ) : null}
    </View>
  );
}
