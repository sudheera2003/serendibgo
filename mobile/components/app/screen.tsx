import * as React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, View } from 'react-native';
import { cn } from '@/lib/utils';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  className?: string;
  contentClassName?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: React.ReactNode;
}

/** Standard page container: scrolls, avoids the keyboard, supports pull-to-refresh and a sticky footer. */
export function Screen({ children, scroll = true, className, contentClassName, refreshing, onRefresh, footer }: Props) {
  const body = scroll ? (
    <ScrollView
      className="flex-1"
      contentContainerClassName={cn('gap-4 p-4 pb-10 w-full max-w-3xl self-center', contentClassName)}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
      {children}
    </ScrollView>
  ) : (
    <View className={cn('flex-1 w-full max-w-3xl self-center', contentClassName)}>{children}</View>
  );
  return (
    <KeyboardAvoidingView className={cn('flex-1 bg-background', className)} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      {body}
      {footer ? <View className="border-t border-border bg-background px-4 pb-6 pt-3 w-full max-w-3xl self-center">{footer}</View> : null}
    </KeyboardAvoidingView>
  );
}
