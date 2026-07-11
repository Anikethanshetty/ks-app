import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

/** Temporary section screen used while the real screens are built per phase. */
export function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center gap-2 px-gutter">
        <Text className="text-center font-anek-semibold text-h1 text-enamel">{title}</Text>
        <Text className="text-center font-anek text-body text-ink-soft">{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}
