import { ActivityIndicator, View } from "react-native";

/**
 * The launch route. It renders nothing but a spinner — the root route guard
 * (see `_layout.tsx`) immediately replaces it with the language picker, login,
 * onboarding, or the signed-in user's role home.
 */
export default function Index() {
  return (
    <View className="flex-1 items-center justify-center bg-paper">
      <ActivityIndicator color="#C8912F" />
    </View>
  );
}
