import { format, formatDistanceToNowStrict, parseISO } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth-store';

interface Rates {
  items: { currencyCode: string; rateToLkr: number }[];
}

/** LKR is the settlement currency; other currencies are shown as approximations. */
export function useMoney() {
  const currency = useAuth((s) => s.user?.preferredCurrency ?? 'LKR');
  const { data } = useQuery({ queryKey: ['rates'], queryFn: () => api.get<Rates>('/exchange-rates'), staleTime: 6 * 3600_000 });
  const rate = data?.items.find((r) => r.currencyCode === currency)?.rateToLkr;
  return (lkr: number, opts: { approxOnly?: boolean } = {}) => {
    const base = lkrText(lkr);
    if (currency === 'LKR' || !rate) return base;
    const converted = new Intl.NumberFormat('en', { style: 'currency', currency, maximumFractionDigits: lkr / rate < 100 ? 2 : 0 }).format(lkr / rate);
    return opts.approxOnly ? `≈ ${converted}` : `${base} (≈ ${converted})`;
  };
}

export const lkrText = (n: number) => `LKR ${Number(n).toLocaleString('en-LK', { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(Number(n)) ? 0 : 2 })}`;

export const toDate = (v: string | Date) => (typeof v === 'string' ? parseISO(v) : v);
export const fmtDate = (v?: string | Date | null) => (v ? format(toDate(v), 'd MMM yyyy') : '—');
export const fmtDateShort = (v?: string | Date | null) => (v ? format(toDate(v), 'd MMM') : '—');
export const fmtDateTime = (v?: string | Date | null) => (v ? format(toDate(v), 'd MMM yyyy, h:mm a') : '—');
export const ago = (v: string | Date) => formatDistanceToNowStrict(toDate(v), { addSuffix: true });
export const isoDay = (d: Date) => format(d, 'yyyy-MM-dd');

export const duration = (min: number) => {
  if (!min) return '0 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h ${m ? `${m} min` : ''}`.trim() : `${m} min`;
};

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
