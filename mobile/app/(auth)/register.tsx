import * as React from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { CompassIcon, StoreIcon, UserRoundCheckIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Field, TextField } from '@/components/app/form';
import { ApiError, api } from '@/lib/api';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils';

const schema = z.object({
  role: z.enum(['tourist', 'provider', 'vendor']),
  fullName: z.string().trim().min(2, 'Enter your full name'),
  email: z.string().trim().email('Enter a valid e-mail'),
  phone: z.string().trim().max(30).optional(),
  password: z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
  acceptTerms: z.boolean().refine((v) => v, 'Please accept to continue'),
});
type Form = z.infer<typeof schema>;

const ROLES = [
  { value: 'tourist', icon: CompassIcon, title: 'Traveller', text: 'Plan trips, book and shop' },
  { value: 'provider', icon: UserRoundCheckIcon, title: 'Service provider', text: 'Guide, tour operator or vehicle owner' },
  { value: 'vendor', icon: StoreIcon, title: 'Artisan vendor', text: 'Sell local products' },
] as const;

export default function Register() {
  const [busy, setBusy] = React.useState(false);
  const { control, handleSubmit, setError } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { role: 'tourist', fullName: '', email: '', phone: '', password: '', acceptTerms: false } });

  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      const res = await api.public<{ email: string; devOtp?: string }>('/auth/register', { ...v, phone: v.phone || undefined });
      toast.success('Account created', 'Enter the 6-digit code we e-mailed you.');
      router.push({ pathname: '/verify', params: { email: res.email, devOtp: res.devOtp ?? '' } });
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('email', { message: e.message });
      else if (e instanceof ApiError && e.details) Object.keys(e.details as object).forEach((k) => setError(k as keyof Form, { message: e.field(k) }));
      else toast.error(e, 'Could not create the account');
    } finally {
      setBusy(false);
    }
  });

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="h3">Create your account</Text>
        <Text variant="muted">Choose how you will use SerendibGO.</Text>
      </View>
      <Controller
        control={control}
        name="role"
        render={({ field }) => (
          <View className="gap-2">
            {ROLES.map((r) => {
              const active = field.value === r.value;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => field.onChange(r.value)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  className={cn('flex-row items-center gap-3 rounded-xl border p-3', active ? 'border-primary bg-accent' : 'border-border')}>
                  <Icon as={r.icon} size={22} className={active ? 'text-primary' : 'text-muted-foreground'} />
                  <View className="flex-1">
                    <Text className="font-semibold">{r.title}</Text>
                    <Text variant="muted">{r.text}</Text>
                  </View>
                  <View className={cn('h-5 w-5 rounded-full border-2', active ? 'border-primary bg-primary' : 'border-border')} />
                </Pressable>
              );
            })}
          </View>
        )}
      />
      <TextField control={control} name="fullName" label="Full name" autoComplete="name" />
      <TextField control={control} name="email" label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextField control={control} name="phone" label="Phone (optional)" keyboardType="phone-pad" autoComplete="tel" />
      <TextField control={control} name="password" label="Password" secureTextEntry hint="At least 8 characters with a letter and a number" autoComplete="new-password" />
      <Controller
        control={control}
        name="acceptTerms"
        render={({ field, fieldState }) => (
          <Field error={fieldState.error?.message}>
            <Pressable className="flex-row items-start gap-3" onPress={() => field.onChange(!field.value)}>
              <Checkbox checked={field.value} onCheckedChange={field.onChange} className="mt-0.5" />
              <Text variant="muted" className="flex-1 text-sm">
                I agree that SerendibGO may process my personal data to provide its services, as described in the privacy policy (Personal Data Protection Act No. 9 of 2022).
              </Text>
            </Pressable>
          </Field>
        )}
      />
      <Button size="lg" onPress={() => submit()} disabled={busy}>
        <Text>{busy ? 'Creating account…' : 'Create account'}</Text>
      </Button>
    </Screen>
  );
}
