import { Stack } from 'expo-router';

export default function AdminLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="destinations" options={{ title: 'Destinations' }} />
      <Stack.Screen name="destination-editor" options={{ title: 'Destination' }} />
      <Stack.Screen name="categories" options={{ title: 'Product categories' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="monitor" options={{ title: 'Bookings & orders' }} />
      <Stack.Screen name="audit-logs" options={{ title: 'Audit log' }} />
    </Stack>
  );
}
