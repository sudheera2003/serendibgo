import * as React from 'react';
import { View } from 'react-native';
import { Link, router } from 'expo-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { TextField } from '@/components/app/form';
import { ApiError, api } from '@/lib/api';
import { signIn } from '@/lib/session';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';

const schema = z.object({ email: z.string().trim().email('Enter a valid e-mail'), password: z.string().min(1, 'Enter your password') });

const DEMO = [
  ['Tourist', 'tourist@serendibgo.lk'],
  ['Guide', 'guide@serendibgo.lk'],
  ['Tour operator', 'tours@serendibgo.lk'],
  ['Vehicle owner', 'drive@serendibgo.lk'],
  ['Vendor', 'vendor@serendibgo.lk'],
  ['Admin', 'admin@serendibgo.lk'],
];

export default function Login() {
  const [busy, setBusy] = React.useState(false);
  const { control, handleSubmit, setValue } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const submit = handleSubmit(async (v) => {
    setBusy(true);
    try {
      const data = await api.public<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', v);
      await signIn(data);
    } catch (e) {
      if (e instanceof ApiError && e.code === 'EMAIL_NOT_VERIFIED') {
        toast.info('Verify your e-mail', 'We sent you a new 6-digit code.');
        router.push({ pathname: '/verify', params: { email: v.email.toLowerCase(), devOtp: (e.body?.devOtp as string) ?? '' } });
      } else toast.error(e, 'Could not log in');
    } finally {
      setBusy(false);
    }
  });

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="h3">Welcome back</Text>
        <Text variant="muted">Log in to continue your journey.</Text>
      </View>
      <TextField control={control} name="email" label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
      <TextField control={control} name="password" label="Password" secureTextEntry autoComplete="current-password" onSubmitEditing={() => submit()} />
      <Button size="lg" onPress={() => submit()} disabled={busy}>
        <Text>{busy ? 'Logging in…' : 'Log in'}</Text>
      </Button>
      <View className="flex-row justify-between">
        <Link href="/forgot-password">
          <Text className="text-sm text-primary">Forgot password?</Text>
        </Link>
        <Link href="/register">
          <Text className="text-sm text-primary">Create an account</Text>
        </Link>
      </View>

      {__DEV__ ? (
        <View className="mt-6 gap-2 rounded-xl border border-dashed border-border p-4">
          <Text className="text-sm font-semibold">Demo accounts (password: Password123)</Text>
          <View className="flex-row flex-wrap gap-2">
            {DEMO.map(([label, email]) => (
              <Button
                key={email}
                size="sm"
                variant="secondary"
                onPress={() => {
                  setValue('email', email);
                  setValue('password', 'Password123');
                }}>
                <Text>{label}</Text>
              </Button>
            ))}
          </View>
        </View>
      ) : null}
    </Screen>
  );
}
