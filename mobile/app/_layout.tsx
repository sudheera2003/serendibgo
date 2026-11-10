import '@/global.css';

import * as React from 'react';
import { ThemeProvider } from 'expo-router/react-navigation';
import { PortalHost } from '@rn-primitives/portal';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { QueryClientProvider } from '@tanstack/react-query';
import { loadThemePreference, useThemeMode } from '@/lib/theme-pref';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { NAV_THEME } from '@/lib/theme';
import { queryClient } from '@/lib/query';
import { useAuth } from '@/lib/auth-store';
import { registerForPush } from '@/lib/push';
import { ToastHost } from '@/components/app/toast-host';
import { ConfirmProvider } from '@/components/app/confirm';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const colorScheme = useThemeMode((s) => s.mode);
  const status = useAuth((s) => s.status);
  const role = useAuth((s) => s.user?.role);
  const hydrate = useAuth((s) => s.hydrate);

  React.useEffect(() => {
    Promise.all([loadThemePreference(), hydrate()]).finally(() => SplashScreen.hideAsync().catch(() => {}));
  }, [hydrate]);

  React.useEffect(() => {
    if (status === 'signedIn') void registerForPush();
  }, [status]);

  if (status === 'loading') return null;
  const signedIn = status === 'signedIn';

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={NAV_THEME[colorScheme ?? 'light']}>
          <ConfirmProvider>
            <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              {/* Each role can only reach its own part of the app (role-based access control). */}
              <Stack.Protected guard={!signedIn}>
                <Stack.Screen name="(auth)" />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && role === 'tourist'}>
                <Stack.Screen name="tourist" />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && role === 'provider'}>
                <Stack.Screen name="provider" />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && role === 'vendor'}>
                <Stack.Screen name="vendor" />
              </Stack.Protected>
              <Stack.Protected guard={signedIn && role === 'admin'}>
                <Stack.Screen name="admin" />
              </Stack.Protected>
              <Stack.Protected guard={signedIn}>
                <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notifications' }} />
              </Stack.Protected>
            </Stack>
            <ToastHost />
            <PortalHost />
          </ConfirmProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
