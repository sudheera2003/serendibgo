import * as React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/ui/text';

export interface MapPoint {
  lat: number;
  lng: number;
  title: string;
  kind?: 'start' | 'stop';
}

// Sri Lanka's bounding box, used to project points onto a simple outline view in the browser.
const B = { minLat: 5.85, maxLat: 9.9, minLng: 79.5, maxLng: 81.95 };
const x = (lng: number) => ((lng - B.minLng) / (B.maxLng - B.minLng)) * 100;
const y = (lat: number) => (1 - (lat - B.minLat) / (B.maxLat - B.minLat)) * 100;

/** The web build (used for the admin desk view and demos) shows a lightweight schematic map. */
export function RouteMap({ points, path, height = 260, hint }: { points: MapPoint[]; path?: [number, number][] | null; height?: number; hint?: string }) {
  if (!points.length) {
    return (
      <View className="items-center justify-center rounded-xl bg-muted" style={{ height }}>
        <Text variant="muted">Add stops to see your route</Text>
      </View>
    );
  }
  let n = 0;
  return (
    <View className="overflow-hidden rounded-xl border border-border bg-sky-50 dark:bg-sky-950/30" style={{ height }}>
      {path && path.length > 1 ? (
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0 }}>
          <polyline points={path.map(([lat, lng]) => `${x(lng)},${y(lat)}`).join(' ')} fill="none" stroke="#0F766E" strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        </svg>
      ) : null}
      {points.map((p, i) => {
        const label = p.kind === 'start' ? 'S' : String(++n);
        return (
          <View key={i} className="absolute items-center" style={[{ left: `${x(p.lng)}%`, top: `${y(p.lat)}%` } as object, { transform: [{ translateX: -14 }, { translateY: -14 }] }]}>
            <View className={p.kind === 'start' ? 'h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-zinc-800' : 'h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-teal-700'}>
              <Text className="text-xs font-bold text-white">{label}</Text>
            </View>
          </View>
        );
      })}
      <Text variant="muted" className="absolute bottom-2 right-3 text-[10px]">
        {points.length > 1 && !(path && path.length > 1) && hint ? hint : 'Schematic view · open the mobile app for the full map'}
      </Text>
    </View>
  );
}
