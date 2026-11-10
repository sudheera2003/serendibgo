import * as React from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import type { LucideIcon } from 'lucide-react-native';
import {
  BusIcon,
  CarIcon,
  ChevronRightIcon,
  CoffeeIcon,
  LandmarkIcon,
  LeafIcon,
  MountainIcon,
  PackageIcon,
  PalmtreeIcon,
  PawPrintIcon,
  ShieldCheckIcon,
  SparklesIcon,
  StarIcon,
  TrainFrontIcon,
  WavesIcon,
} from 'lucide-react-native';
import { Badge } from '@/components/ui/badge';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { titleCase } from '@/lib/format';
import { cn } from '@/lib/utils';

// ---- Status badges ----------------------------------------------------------------------

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-100 dark:bg-amber-900/40',
  pending_payment: 'bg-amber-100 dark:bg-amber-900/40',
  accepted: 'bg-sky-100 dark:bg-sky-900/40',
  in_progress: 'bg-sky-100 dark:bg-sky-900/40',
  packed: 'bg-sky-100 dark:bg-sky-900/40',
  dispatched: 'bg-indigo-100 dark:bg-indigo-900/40',
  processing: 'bg-sky-100 dark:bg-sky-900/40',
  confirmed: 'bg-emerald-100 dark:bg-emerald-900/40',
  approved: 'bg-emerald-100 dark:bg-emerald-900/40',
  success: 'bg-emerald-100 dark:bg-emerald-900/40',
  delivered: 'bg-emerald-100 dark:bg-emerald-900/40',
  completed: 'bg-teal-100 dark:bg-teal-900/40',
  resolved: 'bg-teal-100 dark:bg-teal-900/40',
  visible: 'bg-teal-100 dark:bg-teal-900/40',
  open: 'bg-amber-100 dark:bg-amber-900/40',
  reported: 'bg-orange-100 dark:bg-orange-900/40',
  declined: 'bg-rose-100 dark:bg-rose-900/40',
  rejected: 'bg-rose-100 dark:bg-rose-900/40',
  cancelled: 'bg-zinc-200 dark:bg-zinc-800',
  failed: 'bg-rose-100 dark:bg-rose-900/40',
  refunded: 'bg-zinc-200 dark:bg-zinc-800',
  hidden: 'bg-zinc-200 dark:bg-zinc-800',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Waiting for provider',
  accepted: 'Accepted · pay now',
  confirmed: 'Confirmed',
  pending_payment: 'Awaiting payment',
  processing: 'Processing',
};

export function StatusBadge({ status, plain }: { status: string; plain?: boolean }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', STATUS_STYLE[status] ?? 'bg-muted')}>
      <Text className="text-xs font-semibold text-foreground">{plain ? titleCase(status) : (STATUS_LABEL[status] ?? titleCase(status))}</Text>
    </Badge>
  );
}

// ---- Ratings ------------------------------------------------------------------------------

export function Rating({ value, count, size = 'sm' }: { value: number; count?: number; size?: 'sm' | 'md' }) {
  if (!count) return <Text variant="muted" className="text-xs">No reviews yet</Text>;
  return (
    <View className="flex-row items-center gap-1">
      <Icon as={StarIcon} size={size === 'sm' ? 14 : 18} className="fill-amber-400 text-amber-400" />
      <Text className={cn('font-semibold', size === 'sm' ? 'text-sm' : 'text-base')}>{Number(value).toFixed(1)}</Text>
      <Text variant="muted" className="text-xs">
        ({count} verified)
      </Text>
    </View>
  );
}

export function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <View className="flex-row gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable key={n} onPress={() => onChange(n)} accessibilityRole="button" accessibilityLabel={`${n} star${n > 1 ? 's' : ''}`} hitSlop={6}>
          <Icon as={StarIcon} size={34} className={n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40'} />
        </Pressable>
      ))}
    </View>
  );
}

export function VerifiedBadge({ label = 'Verified' }: { label?: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full bg-accent px-2 py-0.5">
      <Icon as={ShieldCheckIcon} size={12} className="text-primary" />
      <Text className="text-xs font-semibold text-primary">{label}</Text>
    </View>
  );
}

// ---- Cover images with friendly placeholders ----------------------------------------------

const CATEGORY_ICON: Record<string, [LucideIcon, string]> = {
  heritage: [LandmarkIcon, 'bg-amber-100 dark:bg-amber-950'],
  religious: [SparklesIcon, 'bg-orange-100 dark:bg-orange-950'],
  nature: [LeafIcon, 'bg-emerald-100 dark:bg-emerald-950'],
  wildlife: [PawPrintIcon, 'bg-lime-100 dark:bg-lime-950'],
  hill_country: [MountainIcon, 'bg-teal-100 dark:bg-teal-950'],
  tea: [CoffeeIcon, 'bg-green-100 dark:bg-green-950'],
  scenic: [TrainFrontIcon, 'bg-cyan-100 dark:bg-cyan-950'],
  beach: [PalmtreeIcon, 'bg-sky-100 dark:bg-sky-950'],
  water: [WavesIcon, 'bg-sky-100 dark:bg-sky-950'],
  vehicle: [CarIcon, 'bg-slate-100 dark:bg-slate-900'],
  bus: [BusIcon, 'bg-slate-100 dark:bg-slate-900'],
  product: [PackageIcon, 'bg-rose-100 dark:bg-rose-950'],
  package: [MountainIcon, 'bg-teal-100 dark:bg-teal-950'],
};

export function Cover({ uri, kind, className, iconSize = 32 }: { uri?: string | null; kind: string; className?: string; iconSize?: number }) {
  if (uri) return <Image source={{ uri }} style={{ width: '100%', height: '100%' }} contentFit="cover" className={className} transition={200} />;
  const [IconC, bg] = CATEGORY_ICON[kind] ?? CATEGORY_ICON.package;
  return (
    <View className={cn('h-full w-full items-center justify-center', bg, className)}>
      <Icon as={IconC} size={iconSize} className="text-foreground/50" />
    </View>
  );
}

// ---- Layout helpers -----------------------------------------------------------------------

export function Section({ title, action, children, className }: { title: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <View className={cn('gap-3', className)}>
      <View className="flex-row items-center justify-between">
        <Text className="text-lg font-bold">{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

export function Row({ label, value, bold }: { label: string; value: React.ReactNode; bold?: boolean }) {
  return (
    <View className="flex-row items-start justify-between gap-4 py-1">
      <Text variant="muted" className="flex-1">
        {label}
      </Text>
      {typeof value === 'string' || typeof value === 'number' ? <Text className={cn('text-right', bold && 'font-bold')}>{value}</Text> : value}
    </View>
  );
}

export function ListRow({ title, subtitle, right, onPress, icon }: { title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; icon?: LucideIcon }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4 active:bg-accent">
      {icon ? (
        <View className="rounded-lg bg-accent p-2">
          <Icon as={icon} size={18} className="text-primary" />
        </View>
      ) : null}
      <View className="flex-1 gap-0.5">
        <Text className="font-semibold">{title}</Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
      {right}
      {onPress ? <Icon as={ChevronRightIcon} className="text-muted-foreground" /> : null}
    </Pressable>
  );
}

export function StatCard({ label, value, icon, hint }: { label: string; value: string | number; icon?: LucideIcon; hint?: string }) {
  return (
    <View className="min-w-[45%] flex-1 gap-1 rounded-xl border border-border bg-card p-4">
      <View className="flex-row items-center justify-between">
        <Text variant="muted" className="text-xs uppercase tracking-wide">
          {label}
        </Text>
        {icon ? <Icon as={icon} size={16} className="text-primary" /> : null}
      </View>
      <Text className="text-2xl font-bold">{value}</Text>
      {hint ? <Text variant="muted" className="text-xs">{hint}</Text> : null}
    </View>
  );
}

/** Simple bar chart drawn with views (no extra chart library needed). */
export function BarChart({ data, format = (n) => String(n) }: { data: { label: string; values: { value: number; className: string }[] }[]; format?: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.values.reduce((s, v) => s + v.value, 0)));
  return (
    <View className="h-48 flex-row items-end gap-2">
      {data.map((d) => {
        const total = d.values.reduce((s, v) => s + v.value, 0);
        return (
          <View key={d.label} className="flex-1 items-center gap-1">
            <Text variant="muted" className="text-[10px]" numberOfLines={1}>
              {total ? format(total) : ''}
            </Text>
            <View className="w-full justify-end overflow-hidden rounded-t-md bg-muted" style={{ height: 130 }}>
              {d.values.map((v, i) => (
                <View key={i} className={v.className} style={{ height: `${(v.value / max) * 100}%` }} />
              ))}
            </View>
            <Text variant="muted" className="text-xs">
              {d.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
