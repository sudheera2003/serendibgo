import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShadowVisible: false, headerTitle: '', headerBackTitle: 'Back' }}>
      <Stack.Screen name="welcome" options={{ headerShown: false }} />
    </Stack>
  );
}
