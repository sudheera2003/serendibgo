import { env } from '../config/env';
import { prisma, num } from '../lib/prisma';
import { estimateRoad, LatLng, round2 } from '../algorithms/geo';

export type DistanceSource = 'google' | 'ors' | 'estimate';

export interface Matrix {
  km: number[][];
  min: number[][];
  source: DistanceSource;
}

const key = (p: LatLng) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`;

async function googleMatrix(points: LatLng[]): Promise<Matrix> {
  const waypoints = points.map((p) => ({ waypoint: { location: { latLng: { latitude: p.lat, longitude: p.lng } } } }));
  const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,distanceMeters,duration,condition',
    },
    body: JSON.stringify({ origins: waypoints, destinations: waypoints, travelMode: 'DRIVE', routingPreference: 'TRAFFIC_UNAWARE' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Routes API ${res.status}: ${await res.text()}`);
  const elements = (await res.json()) as Array<{ originIndex?: number; destinationIndex?: number; distanceMeters?: number; duration?: string; condition?: string }>;
  const n = points.length;
  const km = Array.from({ length: n }, () => Array(n).fill(0));
  const min = Array.from({ length: n }, () => Array(n).fill(0));
  for (const e of elements) {
    const i = e.originIndex ?? 0;
    const j = e.destinationIndex ?? 0;
    if (i === j) continue;
    if (e.condition && e.condition !== 'ROUTE_EXISTS') throw new Error('No route between some stops');
    km[i][j] = round2((e.distanceMeters ?? 0) / 1000);
    min[i][j] = Math.round(parseInt(String(e.duration ?? '0s'), 10) / 60);
  }
  return { km, min, source: 'google' };
}

async function orsMatrix(points: LatLng[]): Promise<Matrix> {
  const res = await fetch('https://api.openrouteservice.org/v2/matrix/driving-car', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.ORS_API_KEY },
    body: JSON.stringify({ locations: points.map((p) => [p.lng, p.lat]), metrics: ['distance', 'duration'], units: 'km' }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`OpenRouteService ${res.status}`);
  const data = (await res.json()) as { distances: number[][]; durations: number[][] };
  return {
    km: data.distances.map((r) => r.map((v) => round2(v ?? 0))),
    min: data.durations.map((r) => r.map((v) => Math.round((v ?? 0) / 60))),
    source: 'ors',
  };
}

function estimatedMatrix(points: LatLng[]): Matrix {
  const n = points.length;
  const km = Array.from({ length: n }, () => Array(n).fill(0));
  const min = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j) {
        const r = estimateRoad(points[i], points[j]);
        km[i][j] = r.distanceKm;
        min[i][j] = r.durationMin;
      }
  return { km, min, source: 'estimate' };
}

/**
 * n x n distance/time matrix for the given points.
 * Pairs already in the cache never trigger a new external call (NFR02);
 * otherwise one Routes API request fetches the whole matrix.
 */
export async function distanceMatrix(points: LatLng[]): Promise<Matrix> {
  const n = points.length;
  const keys = points.map(key);
  const cached = await prisma.distanceCache.findMany({ where: { originKey: { in: keys }, destKey: { in: keys } } });
  const map = new Map(cached.map((c) => [`${c.originKey}|${c.destKey}`, c]));
  let complete = true;
  const km = Array.from({ length: n }, () => Array(n).fill(0));
  const min = Array.from({ length: n }, () => Array(n).fill(0));
  const sources = new Set<string>();
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j || keys[i] === keys[j]) continue;
      const hit = map.get(`${keys[i]}|${keys[j]}`);
      if (!hit) {
        complete = false;
        continue;
      }
      km[i][j] = num(hit.distanceKm);
      min[i][j] = hit.durationMin;
      sources.add(hit.source);
    }
  if (complete) return { km, min, source: (sources.has('estimate') ? 'estimate' : [...sources][0] ?? 'estimate') as DistanceSource };

  let result: Matrix;
  try {
    if (env.GOOGLE_MAPS_API_KEY) result = await googleMatrix(points);
    else if (env.ORS_API_KEY) result = await orsMatrix(points);
    else result = estimatedMatrix(points);
  } catch (err) {
    console.warn('[distance] provider failed, using estimate:', (err as Error).message);
    result = estimatedMatrix(points);
  }

  // Only real road distances are worth caching long-term.
  if (result.source !== 'estimate') {
    const rows = [];
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++)
        if (i !== j && keys[i] !== keys[j])
          rows.push({ originKey: keys[i], destKey: keys[j], distanceKm: result.km[i][j], durationMin: result.min[i][j], source: result.source });
    await prisma.distanceCache.createMany({ data: rows, skipDuplicates: true });
  }
  return result;
}
