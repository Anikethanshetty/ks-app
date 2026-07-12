import { Stack } from "expo-router";

export default function CustomerLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="products/[categoryId]" />
      <Stack.Screen name="product/[id]" />
      <Stack.Screen name="search" />
      <Stack.Screen name="cart" />
    </Stack>
  );
}
