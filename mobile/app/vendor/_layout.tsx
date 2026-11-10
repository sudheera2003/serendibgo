import { Stack } from 'expo-router';

export default function VendorLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="application" options={{ title: 'Shop verification' }} />
      <Stack.Screen name="product-editor" options={{ title: 'Product' }} />
    </Stack>
  );
}
