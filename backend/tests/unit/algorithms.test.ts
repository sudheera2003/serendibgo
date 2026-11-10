import { haversineMeters, estimateRoad, CHECKIN_RADIUS_M } from '../../src/algorithms/geo';
import { nearestNeighbour, optimiseRoute, routeLength, twoOpt } from '../../src/algorithms/routeOptimizer';
import { bayesianScore } from '../../src/algorithms/trustScore';
import { rangesOverlap, rentalDays, vehicleQuote, packageQuote } from '../../src/algorithms/pricing';

const KANDY = { lat: 7.2936, lng: 80.6413 };
const COLOMBO = { lat: 6.9167, lng: 79.8562 };

describe('Haversine distance', () => {
  it('measures Colombo to Kandy as about 95 km in a straight line', () => {
    const km = haversineMeters(COLOMBO, KANDY) / 1000;
    expect(km).toBeGreaterThan(90);
    expect(km).toBeLessThan(100);
  });
  it('is zero for the same point and symmetric', () => {
    expect(haversineMeters(KANDY, KANDY)).toBe(0);
    expect(haversineMeters(KANDY, COLOMBO)).toBeCloseTo(haversineMeters(COLOMBO, KANDY), 6);
  });
  it('treats a point 300 m away as inside the check-in radius', () => {
    const near = { lat: KANDY.lat + 0.0027, lng: KANDY.lng }; // ~300 m north
    expect(haversineMeters(KANDY, near)).toBeLessThan(CHECKIN_RADIUS_M);
  });
  it('estimates road distance longer than the straight line', () => {
    const r = estimateRoad(COLOMBO, KANDY);
    expect(r.distanceKm).toBeGreaterThan(haversineMeters(COLOMBO, KANDY) / 1000);
    expect(r.durationMin).toBeGreaterThan(0);
  });
});

/** Exact answer by trying every order (only for tiny inputs). */
function bruteForce(d: number[][]) {
  const nodes = Array.from({ length: d.length - 1 }, (_, i) => i + 1);
  let best = Infinity;
  const perm = (arr: number[], l: number) => {
    if (l === arr.length) {
      best = Math.min(best, routeLength(arr, d));
      return;
    }
    for (let i = l; i < arr.length; i++) {
      [arr[l], arr[i]] = [arr[i], arr[l]];
      perm(arr, l + 1);
      [arr[l], arr[i]] = [arr[i], arr[l]];
    }
  };
  perm(nodes, 0);
  return best;
}

function randomMatrix(n: number, seed: number) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const pts = Array.from({ length: n }, () => ({ x: rnd() * 100, y: rnd() * 100 }));
  return pts.map((a) => pts.map((b) => Math.hypot(a.x - b.x, a.y - b.y)));
}

describe('Route optimiser (nearest neighbour + 2-opt)', () => {
  it('visits every stop exactly once', () => {
    const d = randomMatrix(9, 7);
    const { order } = optimiseRoute(d);
    expect([...order].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  it('removes a crossing that nearest neighbour leaves behind', () => {
    // Points on a line: start 0 at x=0, stops at x = 1, 10, 2 -> best order goes 1,2,10.
    const xs = [0, 1, 10, 2];
    const d = xs.map((a) => xs.map((b) => Math.abs(a - b)));
    expect(routeLength(twoOpt([2, 1, 3], d), d)).toBeLessThan(routeLength([2, 1, 3], d));
    expect(optimiseRoute(d).length).toBe(10);
  });
  it('is never worse than nearest neighbour and stays close to optimal', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const d = randomMatrix(8, seed);
      const nn = routeLength(nearestNeighbour(d), d);
      const opt = optimiseRoute(d).length;
      expect(opt).toBeLessThanOrEqual(nn + 1e-9);
      expect(opt).toBeLessThanOrEqual(bruteForce(d) * 1.1);
    }
  });
  it('handles trips with 0 or 1 stop', () => {
    expect(optimiseRoute([[0]]).order).toEqual([]);
    expect(optimiseRoute([[0, 5], [5, 0]]).order).toEqual([1]);
  });
});

describe('Bayesian trust score', () => {
  it('returns 0 with no reviews', () => expect(bayesianScore([])).toBe(0));
  it('does not let a single 5-star review beat many 4.8-star reviews', () => {
    const one = bayesianScore([5], 3.5, 5);
    const many = bayesianScore(Array(40).fill(4.8), 3.5, 5);
    expect(many).toBeGreaterThan(one);
  });
  it('approaches the real average as reviews grow', () => {
    expect(bayesianScore(Array(1000).fill(4), 3.5, 5)).toBeCloseTo(4, 1);
  });
});

describe('Pricing', () => {
  const d = (s: string) => new Date(`${s}T00:00:00Z`);
  it('counts pickup and return days inclusively', () => {
    expect(rentalDays(d('2026-11-01'), d('2026-11-01'))).toBe(1);
    expect(rentalDays(d('2026-11-01'), d('2026-11-03'))).toBe(3);
  });
  it('detects overlapping bookings', () => {
    expect(rangesOverlap(d('2026-11-01'), d('2026-11-03'), d('2026-11-03'), d('2026-11-05'))).toBe(true);
    expect(rangesOverlap(d('2026-11-01'), d('2026-11-02'), d('2026-11-03'), d('2026-11-05'))).toBe(false);
  });
  it('itemises every charge in a vehicle quote', () => {
    const q = vehicleQuote({ pricePerDay: 9500, pricePerKm: 45, driverFeePerDay: 3500, withDriver: true }, d('2026-11-01'), d('2026-11-03'), 220);
    expect(q.days).toBe(3);
    expect(q.lines.map((l) => l.amount)).toEqual([28500, 9900, 10500]);
    expect(q.total).toBe(48900);
  });
  it('omits the driver line for self-drive vehicles', () => {
    const q = vehicleQuote({ pricePerDay: 4500, pricePerKm: 0, driverFeePerDay: 0, withDriver: false }, d('2026-11-01'), d('2026-11-02'), 50);
    expect(q.lines).toHaveLength(1);
    expect(q.total).toBe(9000);
  });
  it('multiplies package price by persons', () => expect(packageQuote(45000, 2).total).toBe(90000));
});
