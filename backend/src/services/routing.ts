import { env, isTest } from '../config/env';
import { LatLng, round2 } from '../algorithms/geo';

export type RouteSource = 'google' | 'ors' | 'osrm' | 'valhalla';

export interface RoadRoute {
  legs: { km: number; min: number }[];
  /** Road geometry as [lat, lng] pairs, simplified for the map. */
  geometry: [number, number][];
  source: RouteSource;
}

const TIMEOUT = 10_000;

/** Decodes Google/Valhalla encoded polylines (precision 5 for Google, 6 for Valhalla). */
export function decodePolyline(str: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const out: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < str.length) {
    for (const which of [0, 1]) {
      let shift = 0;
      let result = 0;
      let byte: number;
      do {
        byte = str.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += delta;
      else lng += delta;
    }
    out.push([lat / factor, lng / factor]);
  }
  return out;
}

/** Keeps at most `max` points so the app stays fast; always keeps the first and last point. */
export function simplify(points: [number, number][], max = 1200): [number, number][] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: [number, number][] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

async function google(points: LatLng[], avoidHighways: boolean): Promise<RoadRoute> {
  const wp = (p: LatLng) => ({ location: { latLng: { latitude: p.lat, longitude: p.lng } } });
  const res = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': env.GOOGLE_MAPS_API_KEY,
      'X-Goog-FieldMask': 'routes.legs.distanceMeters,routes.legs.duration,routes.polyline.encodedPolyline',
    },
    body: JSON.stringify({
      origin: wp(points[0]),
      destination: wp(points[points.length - 1]),
      intermediates: points.slice(1, -1).map(wp),
      travelMode: 'DRIVE',
      routingPreference: 'TRAFFIC_UNAWARE',
      routeModifiers: { avoidHighways, avoidTolls: avoidHighways },
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Google routes ${res.status}`);
  const r = ((await res.json()) as { routes?: { legs: { distanceMeters?: number; duration?: string }[]; polyline: { encodedPolyline: string } }[] }).routes?.[0];
  if (!r) throw new Error('Google returned no route');
  return {
    legs: r.legs.map((l) => ({ km: round2((l.distanceMeters ?? 0) / 1000), min: Math.round(parseInt(l.duration ?? '0', 10) / 60) })),
    geometry: decodePolyline(r.polyline.encodedPolyline, 5),
    source: 'google',
  };
}

async function ors(points: LatLng[], avoidHighways: boolean): Promise<RoadRoute> {
  const res = await fetch('https://api.openrouteservice.org/v2/directions/driving-car/geojson', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: env.ORS_API_KEY },
    // Sri Lankan expressways are toll roads; ORS's "highways" flag does not exclude them, "tollways" does.
    body: JSON.stringify({ coordinates: points.map((p) => [p.lng, p.lat]), ...(avoidHighways ? { options: { avoid_features: ['tollways'] } } : {}) }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`OpenRouteService ${res.status}`);
  const f = ((await res.json()) as { features: { geometry: { coordinates: [number, number][] }; properties: { segments: { distance: number; duration: number }[] } }[] }).features[0];
  return {
    legs: f.properties.segments.map((s) => ({ km: round2(s.distance / 1000), min: Math.round(s.duration / 60) })),
    geometry: f.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    source: 'ors',
  };
}

/** Free OpenStreetMap router (public demo server). Cannot avoid expressways. */
async function osrm(points: LatLng[]): Promise<RoadRoute> {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';');
  const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`, {
    headers: { 'User-Agent': 'SerendibGO-capstone/1.0' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`OSRM ${res.status}`);
  const j = (await res.json()) as { code: string; routes?: { legs: { distance: number; duration: number }[]; geometry: { coordinates: [number, number][] } }[] };
  const r = j.routes?.[0];
  if (j.code !== 'Ok' || !r) throw new Error(`OSRM ${j.code}`);
  return {
    legs: r.legs.map((l) => ({ km: round2(l.distance / 1000), min: Math.round(l.duration / 60) })),
    geometry: r.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    source: 'osrm',
  };
}

/** Free OpenStreetMap router (public FOSSGIS server). Supports avoiding expressways. */
async function valhalla(points: LatLng[], avoidHighways: boolean): Promise<RoadRoute> {
  const body = {
    locations: points.map((p) => ({ lat: p.lat, lon: p.lng })),
    costing: 'auto',
    // Sri Lanka's expressways are all toll roads, so avoiding tolls avoids exactly the expressways
    // while still using the normal A and B roads (use_highways would also avoid major A roads).
    costing_options: { auto: avoidHighways ? { use_tolls: 0, use_highways: 1 } : { use_tolls: 1 } },
    units: 'kilometers',
    directions_type: 'none',
  };
  const res = await fetch(`https://valhalla1.openstreetmap.de/route?json=${encodeURIComponent(JSON.stringify(body))}`, {
    headers: { 'User-Agent': 'SerendibGO-capstone/1.0' },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new Error(`Valhalla ${res.status}`);
  const trip = ((await res.json()) as { trip?: { legs: { shape: string; summary: { length: number; time: number } }[] } }).trip;
  if (!trip) throw new Error('Valhalla returned no route');
  return {
    legs: trip.legs.map((l) => ({ km: round2(l.summary.length), min: Math.round(l.summary.time / 60) })),
    geometry: trip.legs.flatMap((l) => decodePolyline(l.shape, 6)),
    source: 'valhalla',
  };
}

/**
 * Real road route through the points in the given order.
 * Tries Google (if a key is set), OpenRouteService (if a key is set), then the free
 * OpenStreetMap routers. Returns null when no router is reachable.
 */
export async function roadRoute(points: LatLng[], avoidHighways: boolean): Promise<RoadRoute | null> {
  if (points.length < 2 || isTest) return null; // tests must not depend on outside services
  const attempts: (() => Promise<RoadRoute>)[] = [];
  if (env.GOOGLE_MAPS_API_KEY) attempts.push(() => google(points, avoidHighways));
  if (env.ORS_API_KEY) attempts.push(() => ors(points, avoidHighways));
  if (avoidHighways) attempts.push(() => valhalla(points, true));
  else attempts.push(() => osrm(points), () => valhalla(points, false));
  for (const attempt of attempts) {
    try {
      const r = await attempt();
      if (r.legs.length === points.length - 1) return { ...r, geometry: simplify(r.geometry) };
    } catch (err) {
      console.warn('[routing]', (err as Error).message);
    }
  }
  return null;
}
