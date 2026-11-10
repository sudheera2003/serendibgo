import * as React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Control, Controller, FieldValues, Path } from 'react-hook-form';
import { addMonths, eachDayOfInterval, endOfMonth, format, isBefore, isSameDay, startOfDay, startOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon, MinusIcon, PlusIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Text } from '@/components/ui/text';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function Field({ label, error, hint, children, className }: { label?: string; error?: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <View className={cn('gap-1.5', className)}>
      {label ? <Label>{label}</Label> : null}
      {children}
      {error ? <Text className="text-sm text-destructive">{error}</Text> : hint ? <Text variant="muted" className="text-xs">{hint}</Text> : null}
    </View>
  );
}

type InputProps = React.ComponentProps<typeof Input>;

/** Text input wired to react-hook-form. Numbers are converted when `numeric` is set. */
export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  numeric,
  multiline,
  serverError,
  ...rest
}: { control: Control<T>; name: Path<T>; label?: string; hint?: string; numeric?: boolean; multiline?: boolean; serverError?: string } & Omit<InputProps, 'value' | 'onChangeText'>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => {
        const Comp = (multiline ? Textarea : Input) as typeof Input;
        return (
          <Field label={label} error={fieldState.error?.message ?? serverError} hint={hint}>
            <Comp
              value={field.value === undefined || field.value === null ? '' : String(field.value)}
              onChangeText={(t: string) => field.onChange(numeric ? (t === '' ? undefined : Number(t.replace(/[^0-9.]/g, ''))) : t)}
              onBlur={field.onBlur}
              keyboardType={numeric ? 'decimal-pad' : rest.keyboardType}
              aria-invalid={!!fieldState.error}
              className={cn(fieldState.error && 'border-destructive', multiline && 'min-h-24')}
              {...rest}
            />
          </Field>
        );
      }}
    />
  );
}

/** Horizontal pill selector for short option lists. */
export function ChipSelect<V extends string | number>({ options, value, onChange, scroll = true }: { options: { value: V; label: string }[]; value: V | undefined; onChange: (v: V) => void; scroll?: boolean }) {
  const chips = options.map((o) => {
    const active = o.value === value;
    return (
      <Pressable
        key={String(o.value)}
        onPress={() => onChange(o.value)}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        className={cn('rounded-full border px-3.5 py-1.5', active ? 'border-primary bg-primary' : 'border-border bg-background')}>
        <Text className={cn('text-sm', active ? 'font-semibold text-primary-foreground' : 'text-foreground')}>{o.label}</Text>
      </Pressable>
    );
  });
  return scroll ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerClassName="gap-2 pr-4">
      {chips}
    </ScrollView>
  ) : (
    <View className="flex-row flex-wrap gap-2">{chips}</View>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99 }: { value: number; onChange: (n: number) => void; min?: number; max?: number }) {
  return (
    <View className="flex-row items-center gap-3">
      <Button variant="outline" size="icon" onPress={() => onChange(Math.max(min, value - 1))} disabled={value <= min} accessibilityLabel="Decrease">
        <Icon as={MinusIcon} />
      </Button>
      <Text className="min-w-8 text-center text-lg font-semibold">{value}</Text>
      <Button variant="outline" size="icon" onPress={() => onChange(Math.min(max, value + 1))} disabled={value >= max} accessibilityLabel="Increase">
        <Icon as={PlusIcon} />
      </Button>
    </View>
  );
}

/** Cross-platform date picker (works the same on Android, iOS and web). */
export function DateField({ label, value, onChange, minDate, error, placeholder = 'Choose a date' }: { label?: string; value?: Date; onChange: (d: Date) => void; minDate?: Date; error?: string; placeholder?: string }) {
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(startOfMonth(value ?? minDate ?? new Date()));
  const days = eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) });
  const min = minDate ? startOfDay(minDate) : undefined;
  return (
    <Field label={label} error={error}>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" className={cn('h-10 flex-row items-center gap-2 rounded-md border border-input bg-background px-3', error && 'border-destructive')}>
        <Icon as={CalendarIcon} className="text-muted-foreground" />
        <Text className={cn(!value && 'text-muted-foreground')}>{value ? format(value, 'EEE, d MMM yyyy') : placeholder}</Text>
      </Pressable>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[340px] max-w-full">
          <DialogHeader>
            <DialogTitle>{label ?? 'Choose a date'}</DialogTitle>
          </DialogHeader>
          <View className="flex-row items-center justify-between">
            <Button variant="ghost" size="icon" onPress={() => setMonth(addMonths(month, -1))} accessibilityLabel="Previous month">
              <Icon as={ChevronLeftIcon} />
            </Button>
            <Text className="font-semibold">{format(month, 'MMMM yyyy')}</Text>
            <Button variant="ghost" size="icon" onPress={() => setMonth(addMonths(month, 1))} accessibilityLabel="Next month">
              <Icon as={ChevronRightIcon} />
            </Button>
          </View>
          <View className="flex-row">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
              <Text key={i} variant="muted" className="flex-1 text-center text-xs">
                {d}
              </Text>
            ))}
          </View>
          <View className="flex-row flex-wrap">
            {days.map((d) => {
              const disabled = (min && isBefore(d, min)) || d.getMonth() !== month.getMonth();
              const selected = value && isSameDay(d, value);
              return (
                <Pressable
                  key={d.toISOString()}
                  disabled={disabled}
                  onPress={() => {
                    onChange(d);
                    setOpen(false);
                  }}
                  className="items-center justify-center p-0.5"
                  style={{ width: `${100 / 7}%`, aspectRatio: 1 }}>
                  <View className={cn('h-full w-full items-center justify-center rounded-full', selected && 'bg-primary')}>
                    <Text className={cn('text-sm', disabled && 'text-muted-foreground/40', selected && 'font-bold text-primary-foreground')}>{d.getDate()}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </DialogContent>
      </Dialog>
    </Field>
  );
}
