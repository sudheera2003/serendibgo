import { Stack } from 'expo-router';

export default function ProviderLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="application" options={{ title: 'Business verification' }} />
      <Stack.Screen name="package-editor" options={{ title: 'Tour package' }} />
      <Stack.Screen name="vehicle-editor" options={{ title: 'Vehicle' }} />
      <Stack.Screen name="booking/[id]" options={{ title: 'Booking request' }} />
    </Stack>
  );
}
