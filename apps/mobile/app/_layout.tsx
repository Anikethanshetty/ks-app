import "../global.css";
import "@/i18n";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { useFonts } from "expo-font";
import { router, Stack, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import type { Role } from "@kss/shared";
import { fontMap } from "@/lib/fonts";
import { SessionProvider, useSession } from "@/lib/session";

const ROLE_HOME: Record<Role, "/(customer)" | "/(delivery)" | "/(admin)"> = {
  customer: "/(customer)",
  delivery: "/(delivery)",
  admin: "/(admin)",
};

/**
 * The single source of navigation truth (T0.5). Waits for bootstrap, then routes
 * by: no language → picker, signed-out → login, no profile → onboarding, else the
 * role home. Runs on every segment change so deep links land in the right place.
 */
function useRouteGuard() {
  const { ready, languageChosen, user } = useSession();
  const segments = useSegments() as string[];

  useEffect(() => {
    if (!ready) return;
    const inAuth = segments[0] === "(auth)";
    const authScreen = inAuth ? segments[1] : undefined;

    if (!languageChosen) {
      if (authScreen !== "language") router.replace("/(auth)/language");
      return;
    }
    if (!user) {
      if (!inAuth || authScreen === "language") router.replace("/(auth)/login");
      return;
    }
    if (!user.fullName) {
      if (authScreen !== "onboarding") router.replace("/(auth)/onboarding");
      return;
    }
    const home = ROLE_HOME[user.role];
    if (`/${segments[0]}` !== home) router.replace(home);
  }, [ready, languageChosen, user, segments]);
}

function RootNavigator() {
  const { ready } = useSession();
  useRouteGuard();

  if (!ready) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#C8912F" />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FBFAF6" } }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(customer)" />
      <Stack.Screen name="(delivery)" />
      <Stack.Screen name="(admin)" />
    </Stack>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts(fontMap);
  // Hold the splash until the tri-script fonts are ready (avoids a flash of
  // fallback glyphs on Kannada/Hindi text).
  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
