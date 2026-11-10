import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AlertTriangleIcon, InboxIcon, WifiOffIcon } from 'lucide-react-native';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { Text } from '@/components/ui/text';
import { ApiError, errorMessage } from '@/lib/api';

export function LoadingView({ rows = 3 }: { rows?: number }) {
  return (
    <View className="gap-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </View>
  );
}

export function Spinner() {
  return (
    <View className="items-center justify-center p-8">
      <ActivityIndicator />
    </View>
  );
}

export function ErrorView({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const offline = error instanceof ApiError && error.code === 'NETWORK';
  return (
    <View className="items-center gap-3 p-8">
      <Icon as={offline ? WifiOffIcon : AlertTriangleIcon} size={36} className="text-muted-foreground" />
      <Text className="text-center font-semibold">{offline ? 'You are offline' : 'Could not load this'}</Text>
      <Text variant="muted" className="text-center">
        {errorMessage(error)}
      </Text>
      {onRetry ? (
        <Button variant="outline" onPress={onRetry}>
          <Text>Try again</Text>
        </Button>
      ) : null}
    </View>
  );
}

export function EmptyView({ icon = InboxIcon, title, description, action }: { icon?: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <View className="items-center gap-2 px-6 py-10">
      <View className="mb-2 rounded-full bg-accent p-4">
        <Icon as={icon} size={28} className="text-primary" />
      </View>
      <Text className="text-center text-lg font-semibold">{title}</Text>
      {description ? (
        <Text variant="muted" className="text-center">
          {description}
        </Text>
      ) : null}
      {action ? <View className="mt-3">{action}</View> : null}
    </View>
  );
}

/** Renders loading / error states for a query, then the children. */
export function QueryState({ query, children, rows }: { query: { isLoading: boolean; error: unknown; refetch: () => unknown }; children: React.ReactNode; rows?: number }) {
  if (query.isLoading) return <LoadingView rows={rows} />;
  if (query.error) return <ErrorView error={query.error} onRetry={() => query.refetch()} />;
  return <>{children}</>;
}
