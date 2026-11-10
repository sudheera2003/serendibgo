import { round2 } from './geo';

const DAY_MS = 86_400_000;

/** Whole days between two dates, counting both the pickup and return day (minimum 1). */
export function rentalDays(start: Date, end: Date): number {
  const s = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
  const e = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
  return Math.max(1, Math.round((e - s) / DAY_MS) + 1);
}

/** True when two inclusive date ranges overlap (used to prevent double booking). */
export function rangesOverlap(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart <= bEnd && bStart <= aEnd;
}

export interface QuoteLine {
  label: string;
  amount: number;
}

export interface Quote {
  lines: QuoteLine[];
  total: number;
}

/** Transparent vehicle quote: every charge is itemised, nothing is hidden. */
export function vehicleQuote(
  v: { pricePerDay: number; pricePerKm: number; driverFeePerDay: number; withDriver: boolean },
  start: Date,
  end: Date,
  estimatedKm: number,
): Quote & { days: number } {
  const days = rentalDays(start, end);
  const lines: QuoteLine[] = [{ label: `Rental: ${days} day(s) × LKR ${v.pricePerDay.toFixed(2)}`, amount: round2(days * v.pricePerDay) }];
  if (estimatedKm > 0 && v.pricePerKm > 0) {
    lines.push({ label: `Distance: ${estimatedKm} km × LKR ${v.pricePerKm.toFixed(2)}`, amount: round2(estimatedKm * v.pricePerKm) });
  }
  if (v.withDriver && v.driverFeePerDay > 0) {
    lines.push({ label: `Driver: ${days} day(s) × LKR ${v.driverFeePerDay.toFixed(2)}`, amount: round2(days * v.driverFeePerDay) });
  }
  return { days, lines, total: round2(lines.reduce((s, l) => s + l.amount, 0)) };
}

export function packageQuote(pricePerPerson: number, persons: number): Quote {
  const lines = [{ label: `${persons} person(s) × LKR ${pricePerPerson.toFixed(2)}`, amount: round2(persons * pricePerPerson) }];
  return { lines, total: lines[0].amount };
}
