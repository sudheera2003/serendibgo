import * as React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Screen } from '@/components/app/screen';
import { Field } from '@/components/app/form';
import { api } from '@/lib/api';
import { toast } from '@/lib/toast';

export default function ForgotPassword() {
  const [email, setEmail] = React.useState('');
  const [step, setStep] = React.useState<'email' | 'reset'>('email');
  const [otp, setOtp] = React.useState('');
  const [pw, setPw] = React.useState('');
  const [hint, setHint] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const send = async () => {
    setBusy(true);
    try {
      const r = await api.public<{ devOtp?: string }>('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setHint(r.devOtp ?? '');
      setStep('reset');
      toast.success('Check your e-mail', 'If the account exists, we sent a reset code.');
    } catch (e) {
      toast.error(e);
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await api.public('/auth/reset-password', { email: email.trim().toLowerCase(), otp, newPassword: pw });
      toast.success('Password updated', 'Log in with your new password.');
      router.replace('/login');
    } catch (e) {
      toast.error(e, 'Could not reset the password');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View className="gap-1">
        <Text variant="h3">Reset your password</Text>
        <Text variant="muted">{step === 'email' ? 'We will e-mail you a 6-digit code.' : `Enter the code sent to ${email}.`}</Text>
      </View>
      {step === 'email' ? (
        <>
          <Field label="E-mail">
            <Input value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
          </Field>
          <Button size="lg" onPress={send} disabled={busy || !email.includes('@')}>
            <Text>Send code</Text>
          </Button>
        </>
      ) : (
        <>
          <Field label="6-digit code">
            <Input value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
          </Field>
          <Field label="New password" hint="At least 8 characters with a letter and a number">
            <Input value={pw} onChangeText={setPw} secureTextEntry autoComplete="new-password" />
          </Field>
          <Button size="lg" onPress={reset} disabled={busy || otp.length !== 6 || pw.length < 8}>
            <Text>Update password</Text>
          </Button>
          {__DEV__ && hint ? <Text variant="muted" className="text-center text-xs">Development mode: your code is {hint}</Text> : null}
        </>
      )}
    </Screen>
  );
}
