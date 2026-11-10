import * as React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { saveThemePreference, useThemeMode } from '@/lib/theme-pref';
import { KeyRoundIcon, LogOutIcon, MoonIcon, ShieldCheckIcon, Trash2Icon } from 'lucide-react-native';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Text } from '@/components/ui/text';
import { ChipSelect, TextField } from '@/components/app/form';
import { StatusBadge } from '@/components/app/bits';
import { useConfirm } from '@/components/app/confirm';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-store';
import { titleCase } from '@/lib/format';
import { signOut } from '@/lib/session';
import { toast } from '@/lib/toast';
import type { User } from '@/lib/types';

const CURRENCIES = ['LKR', 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CNY'].map((c) => ({ value: c, label: c }));

const profileSchema = z.object({ fullName: z.string().trim().min(2, 'Enter your name'), phone: z.string().trim().max(30).optional() });
const pwSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password'),
  newPassword: z.string().min(8, 'Use at least 8 characters').regex(/[A-Za-z]/, 'Include a letter').regex(/[0-9]/, 'Include a number'),
});

/** Shared profile/settings screen used by every role. `extra` adds role-specific links. */
export function ProfileScreen({ extra }: { extra?: React.ReactNode }) {
  const user = useAuth((s) => s.user)!;
  const setUser = useAuth((s) => s.setUser);
  const confirm = useConfirm();
  const colorScheme = useThemeMode((s) => s.mode);
  const [showPw, setShowPw] = React.useState(false);

  const form = useForm<z.infer<typeof profileSchema>>({ resolver: zodResolver(profileSchema), defaultValues: { fullName: user.fullName, phone: user.phone ?? '' } });
  const pwForm = useForm<z.infer<typeof pwSchema>>({ resolver: zodResolver(pwSchema), defaultValues: { currentPassword: '', newPassword: '' } });

  const save = useMutation({
    mutationFn: (body: Partial<User>) => api.patch<{ user: User }>('/users/me', body),
    onSuccess: async ({ user: u }) => {
      await setUser(u);
      toast.success('Profile updated');
    },
    onError: (e) => toast.error(e),
  });
  const changePw = useMutation({
    mutationFn: (b: z.infer<typeof pwSchema>) => api.post('/auth/change-password', b),
    onSuccess: () => {
      toast.success('Password changed');
      pwForm.reset();
      setShowPw(false);
    },
    onError: (e) => toast.error(e),
  });

  const deleteAccount = async () => {
    const { ok } = await confirm({
      title: 'Delete your account?',
      description: 'Your personal details will be removed permanently. Booking and payment records are kept anonymously for legal reasons.',
      confirmLabel: 'Delete account',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.del('/users/me');
      await signOut();
    } catch (e) {
      toast.error(e);
    }
  };

  const verification = user.providerProfile?.verificationStatus ?? user.vendorProfile?.verificationStatus;
  const initials = user.fullName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-4">
        <Avatar alt={user.fullName} className="h-16 w-16">
          <AvatarFallback className="bg-primary">
            <Text className="text-xl font-bold text-primary-foreground">{initials}</Text>
          </AvatarFallback>
        </Avatar>
        <View className="flex-1 gap-1">
          <Text className="text-xl font-bold">{user.fullName}</Text>
          <Text variant="muted">{user.email}</Text>
          <View className="flex-row flex-wrap gap-2">
            <StatusBadge status={user.role} plain />
            {verification ? <StatusBadge status={verification} plain /> : null}
          </View>
        </View>
      </View>

      {extra}

      <Card>
        <CardHeader>
          <CardTitle>Personal details</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          <TextField control={form.control} name="fullName" label="Full name" autoComplete="name" />
          <TextField control={form.control} name="phone" label="Phone" keyboardType="phone-pad" autoComplete="tel" />
          <Button onPress={() => form.handleSubmit((v) => save.mutate(v))()} disabled={save.isPending}>
            <Text>{save.isPending ? 'Saving…' : 'Save changes'}</Text>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="gap-4">
          <View className="gap-2">
            <Text className="text-sm font-medium">Display prices in</Text>
            <ChipSelect options={CURRENCIES} value={user.preferredCurrency} onChange={(c) => save.mutate({ preferredCurrency: c })} />
            <Text variant="muted" className="text-xs">
              Payments are always charged in Sri Lankan rupees (LKR). Other currencies are approximate.
            </Text>
          </View>
          <Separator />
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <Icon as={MoonIcon} />
              <Text>Dark mode</Text>
            </View>
            <Switch checked={colorScheme === 'dark'} onCheckedChange={(on) => saveThemePreference(on ? 'dark' : 'light')} />
          </View>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Security & privacy</CardTitle>
        </CardHeader>
        <CardContent className="gap-3">
          {showPw ? (
            <View className="gap-3">
              <TextField control={pwForm.control} name="currentPassword" label="Current password" secureTextEntry autoComplete="current-password" />
              <TextField control={pwForm.control} name="newPassword" label="New password" secureTextEntry hint="At least 8 characters with a letter and a number" autoComplete="new-password" />
              <View className="flex-row gap-2">
                <Button variant="outline" className="flex-1" onPress={() => setShowPw(false)}>
                  <Text>Cancel</Text>
                </Button>
                <Button className="flex-1" onPress={() => pwForm.handleSubmit((v) => changePw.mutate(v))()} disabled={changePw.isPending}>
                  <Text>Update</Text>
                </Button>
              </View>
            </View>
          ) : (
            <Button variant="outline" onPress={() => setShowPw(true)}>
              <Icon as={KeyRoundIcon} />
              <Text>Change password</Text>
            </Button>
          )}
          <View className="flex-row items-start gap-2 rounded-lg bg-accent p-3">
            <Icon as={ShieldCheckIcon} className="mt-0.5 text-primary" />
            <Text variant="muted" className="flex-1 text-xs">
              We only keep the data needed to provide the service, in line with Sri Lanka's Personal Data Protection Act No. 9 of 2022. Card details are handled by PayHere and never stored by SerendibGO.
            </Text>
          </View>
          <Button variant="ghost" onPress={deleteAccount}>
            <Icon as={Trash2Icon} className="text-destructive" />
            <Text className="text-destructive">Delete my account</Text>
          </Button>
        </CardContent>
      </Card>

      <Button variant="outline" onPress={signOut}>
        <Icon as={LogOutIcon} />
        <Text>Log out</Text>
      </Button>
      <Text variant="muted" className="text-center text-xs">
        SerendibGO · {titleCase(user.role)} account
      </Text>
    </View>
  );
}

export function goBackOr(path: string) {
  if (router.canGoBack()) router.back();
  else router.replace(path as never);
}
