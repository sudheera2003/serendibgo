import { Stack } from 'expo-router';

export default function TouristLayout() {
  return (
    <Stack screenOptions={{ headerBackTitle: 'Back', headerShadowVisible: false }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="destination/[id]" options={{ title: 'Destination' }} />
      <Stack.Screen name="packages/index" options={{ title: 'Tour packages' }} />
      <Stack.Screen name="packages/compare" options={{ title: 'Compare packages' }} />
      <Stack.Screen name="package/[id]" options={{ title: 'Tour package' }} />
      <Stack.Screen name="book/package/[id]" options={{ title: 'Book package' }} />
      <Stack.Screen name="vehicles/index" options={{ title: 'Rent a vehicle' }} />
      <Stack.Screen name="vehicle/[id]" options={{ title: 'Vehicle' }} />
      <Stack.Screen name="trip/[id]" options={{ title: 'Trip planner' }} />
      <Stack.Screen name="product/[id]" options={{ title: 'Product' }} />
      <Stack.Screen name="cart" options={{ title: 'Your cart' }} />
      <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
      <Stack.Screen name="booking/[id]" options={{ title: 'Booking' }} />
      <Stack.Screen name="order/[id]" options={{ title: 'Order' }} />
      <Stack.Screen name="review/new" options={{ title: 'Write a review', presentation: 'modal' }} />
      <Stack.Screen name="complaints/index" options={{ title: 'My complaints' }} />
      <Stack.Screen name="complaints/new" options={{ title: 'New complaint', presentation: 'modal' }} />
      <Stack.Screen name="payments" options={{ title: 'Payments & receipts' }} />
    </Stack>
  );
}
