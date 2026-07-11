import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { checkHealth } from "@/lib/endpoints";

type Health = "loading" | "ok" | "error";

/**
 * Scaffold landing screen. Verifies: tri-script fonts render, the design tokens
 * apply, and the app can reach GET /health. Role-based routing replaces this in
 * T0.5.
 */
export default function Index() {
  const [health, setHealth] = useState<Health>("loading");

  useEffect(() => {
    checkHealth()
      .then(() => setHealth("ok"))
      .catch(() => setHealth("error"));
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-1 items-center justify-center gap-4 px-gutter">
        <Text className="text-center font-anek-semibold text-h1 text-enamel">
          ಕೃಷ್ಣಪ್ಪ ಶೆಟ್ಟಿ ಆಂಡ್ ಸನ್ಸ್
        </Text>
        <Text className="font-anek text-body-lg text-ink-soft">
          Krishnappa Shetty and Son&apos;s
        </Text>
        <Text className="font-deva-semibold text-h2 text-enamel">कृष्णप्पा शेट्टी</Text>
        <Text className="font-mono text-price-lg text-brass">₹1,062</Text>

        {health === "loading" && <ActivityIndicator color="#C8912F" />}
        {health === "ok" && (
          <Text className="font-anek text-body text-fresh">Connected to the shop</Text>
        )}
        {health === "error" && (
          <Text className="font-anek text-body text-chilli">Couldn&apos;t reach the shop</Text>
        )}

        <View className="mt-4 flex-row flex-wrap justify-center gap-3">
          <Link href="/(auth)/login" className="font-anek-medium text-body text-enamel">
            Auth
          </Link>
          <Link href="/(customer)" className="font-anek-medium text-body text-enamel">
            Customer
          </Link>
          <Link href="/(delivery)" className="font-anek-medium text-body text-enamel">
            Delivery
          </Link>
          <Link href="/(admin)" className="font-anek-medium text-body text-enamel">
            Admin
          </Link>
        </View>
      </View>
    </SafeAreaView>
  );
}
