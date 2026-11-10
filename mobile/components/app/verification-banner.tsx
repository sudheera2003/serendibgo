import { View } from 'react-native';
import { router } from 'expo-router';
import { ClockIcon, ShieldAlertIcon, ShieldCheckIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { VerificationStatus } from '@/lib/types';

/** Explains where a provider/vendor is in the admin verification process. */
export function VerificationBanner({ status, reason, applyPath, kind }: { status?: VerificationStatus; reason?: string | null; applyPath: string; kind: 'provider' | 'vendor' }) {
  if (status === 'approved') return null;
  const listing = kind === 'provider' ? 'packages and vehicles' : 'products';
  if (!status) {
    return (
      <View className="gap-3 rounded-2xl border border-primary/30 bg-accent p-4">
        <View className="flex-row items-center gap-2">
          <Icon as={ShieldCheckIcon} size={20} className="text-primary" />
          <Text className="font-semibold">Get verified to start selling</Text>
        </View>
        <Text variant="muted" className="text-sm">
          Submit your business details and licence. An administrator checks every {kind} before their {listing} appear to tourists.
        </Text>
        <Button onPress={() => router.push(applyPath as never)}>
          <Text>Start verification</Text>
        </Button>
      </View>
    );
  }
  if (status === 'pending') {
    return (
      <View className="flex-row items-start gap-3 rounded-2xl bg-amber-100 p-4 dark:bg-amber-900/30">
        <Icon as={ClockIcon} size={20} className="text-amber-700 dark:text-amber-300" />
        <View className="flex-1">
          <Text className="font-semibold">Verification in progress</Text>
          <Text variant="muted" className="text-sm">
            An administrator is reviewing your application. You can prepare listings once you are approved.
          </Text>
        </View>
      </View>
    );
  }
  return (
    <View className="gap-3 rounded-2xl bg-rose-100 p-4 dark:bg-rose-900/30">
      <View className="flex-row items-center gap-2">
        <Icon as={ShieldAlertIcon} size={20} className="text-destructive" />
        <Text className="font-semibold">Application not approved</Text>
      </View>
      {reason ? <Text className="text-sm">Reason: {reason}</Text> : null}
      <Button variant="outline" onPress={() => router.push(applyPath as never)}>
        <Text>Update and resubmit</Text>
      </Button>
    </View>
  );
}
