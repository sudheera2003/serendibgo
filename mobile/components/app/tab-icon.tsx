import type { ColorValue } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Icon } from '@/components/ui/icon';

export const tabIcon =
  (as: LucideIcon) =>
  ({ color, focused }: { color: ColorValue; focused: boolean }) => <Icon as={as} size={22} color={String(color)} strokeWidth={focused ? 2.4 : 1.8} />;
