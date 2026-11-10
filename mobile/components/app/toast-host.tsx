import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CheckCircle2Icon, InfoIcon, XCircleIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { useToasts } from '@/lib/toast';
import { cn } from '@/lib/utils';

const ICONS = { success: CheckCircle2Icon, error: XCircleIcon, info: InfoIcon };

export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" className="absolute left-0 right-0 items-center gap-2 px-4" style={{ top: insets.top + 8 }}>
      {toasts.map((t) => (
        <Pressable
          key={t.id}
          onPress={() => dismiss(t.id)}
          accessibilityRole="alert"
          className={cn('w-full max-w-md flex-row items-start gap-3 rounded-xl border bg-card p-3 shadow-lg shadow-black/10', t.kind === 'error' ? 'border-destructive/40' : 'border-border')}>
          <Icon as={ICONS[t.kind]} size={20} className={t.kind === 'error' ? 'text-destructive' : t.kind === 'success' ? 'text-primary' : 'text-muted-foreground'} />
          <View className="flex-1">
            <Text className="font-semibold">{t.title}</Text>
            {t.message ? <Text variant="muted">{t.message}</Text> : null}
          </View>
        </Pressable>
      ))}
    </View>
  );
}
