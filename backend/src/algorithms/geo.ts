export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in metres (Haversine formula). */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Check-in radius used for GPS-verified destination reviews (Algorithm 3). */
export const CHECKIN_RADIUS_M = 500;

/**
 * Offline road estimate used when no mapping API key is configured:
 * straight-line distance x 1.35 (typical Sri Lankan road winding factor)
 * at an average of 40 km/h.
 */
export function estimateRoad(a: LatLng, b: LatLng): { distanceKm: number; durationMin: number } {
  const km = (haversineMeters(a, b) / 1000) * 1.35;
  return { distanceKm: round2(km), durationMin: Math.round((km / 40) * 60) };
}

export const round2 = (n: number) => Math.round(n * 100) / 100;
