/**
 * Algorithm 1 – visiting-order optimisation for an open route.
 * Index 0 of the matrix is the start point; indexes 1..n are the stops.
 * Returns the stop indexes (1..n) in the suggested visiting order.
 */
export function routeLength(order: number[], d: number[][]): number {
  let total = 0;
  let prev = 0;
  for (const s of order) {
    total += d[prev][s];
    prev = s;
  }
  return total;
}

/** Greedy tour from the start; `first` optionally forces the first stop. */
export function nearestNeighbour(d: number[][], first?: number): number[] {
  const n = d.length - 1;
  const unvisited = new Set(Array.from({ length: n }, (_, i) => i + 1));
  const order: number[] = [];
  let current = 0;
  if (first) {
    order.push(first);
    unvisited.delete(first);
    current = first;
  }
  while (unvisited.size) {
    let best = -1;
    let bestDist = Infinity;
    for (const u of unvisited) {
      if (d[current][u] < bestDist) {
        bestDist = d[current][u];
        best = u;
      }
    }
    order.push(best);
    unvisited.delete(best);
    current = best;
  }
  return order;
}

/** 2-opt improvement on an open path that starts at node 0 (the start is fixed). */
export function twoOpt(order: number[], d: number[][]): number[] {
  const route = [0, ...order];
  const n = route.length - 1;
  const dist = (a: number, b: number | undefined) => (b === undefined ? 0 : d[a][b]);
  let improved = true;
  let guard = 0;
  while (improved && guard++ < 1000) {
    improved = false;
    for (let i = 1; i < n; i++) {
      for (let k = i + 1; k <= n; k++) {
        const before = dist(route[i - 1], route[i]) + dist(route[k], route[k + 1]);
        const after = dist(route[i - 1], route[k]) + dist(route[i], route[k + 1]);
        if (after + 1e-9 < before) {
          route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route.slice(1);
}

export function optimiseRoute(d: number[][]): { order: number[]; length: number } {
  if (d.length <= 2) {
    const order = d.length === 2 ? [1] : [];
    return { order, length: routeLength(order, d) };
  }
  // Multi-start: try every stop as the first one, improve each with 2-opt, keep the shortest.
  // With at most 10 stops this is still only a few milliseconds.
  let best = twoOpt(nearestNeighbour(d), d);
  let bestLen = routeLength(best, d);
  for (let first = 1; first < d.length; first++) {
    const candidate = twoOpt(nearestNeighbour(d, first), d);
    const len = routeLength(candidate, d);
    if (len + 1e-9 < bestLen) {
      best = candidate;
      bestLen = len;
    }
  }
  return { order: best, length: bestLen };
}
