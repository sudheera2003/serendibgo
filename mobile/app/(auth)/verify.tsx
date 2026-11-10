import * as React from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { MailCheckIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { api } from '@/lib/api';
import { signIn } from '@/lib/session';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';

export default function Verify() {
  const { email, devOtp } = useLocalSearchParams<{ email: string; devOtp?: string }>();
  const [code, setCode] = React.useState('');
  const [hint, setHint] = React.useState(devOtp || '');
  const [busy, setBusy] = React.useState(false);

  const verify = async () => {
    setBusy(true);
    try {
      const data = await api.public<{ user: User; accessToken: string; refreshToken: string }>('/auth/verify-otp', { email, otp: code });
      toast.success('E-mail verified', 'Welcome to SerendibGO!');
      await signIn(data);
    } catch (e) {
      toast.error(e, 'Verification failed');
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    try {
      const r = await api.public<{ devOtp?: string }>('/auth/resend-otp', { email });
      setHint(r.devOtp ?? '');
      toast.success('A new code is on its way');
    } catch (e) {
      toast.error(e);
    }
  };

  return (
    <Screen>
      <View className="items-center gap-3 py-4">
        <View className="rounded-full bg-accent p-4">
          <Icon as={MailCheckIcon} size={32} className="text-primary" />
        </View>
        <Text variant="h3">Check your e-mail</Text>
        <Text variant="muted" className="text-center">
          Enter the 6-digit code we sent to {email}. It expires in 10 minutes.
        </Text>
      </View>
      <Input
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        placeholder="••••••"
        className="h-14 text-center text-2xl tracking-[12px]"
        maxLength={6}
        autoFocus
      />
      <Button size="lg" onPress={verify} disabled={busy || code.length !== 6}>
        <Text>{busy ? 'Verifying…' : 'Verify and continue'}</Text>
      </Button>
      <Button variant="ghost" onPress={resend}>
        <Text>Send a new code</Text>
      </Button>
      {__DEV__ && hint ? (
        <Text variant="muted" className="text-center text-xs">
          Development mode: your code is {hint} (also printed in the API log)
        </Text>
      ) : null}
    </Screen>
  );
}
