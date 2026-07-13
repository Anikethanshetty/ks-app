import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { paymentApi, shopApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/** Convert a `₹X.YZ` or plain numeric string to paise. */
function parsePaise(value: string): number {
  const cleaned = value.replace(/[₹,]/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  return Math.round(num * 100);
}

export default function AdminSettingsScreen() {
  const { t } = useTranslation();

  const settingsQuery = useQuery({
    queryKey: ["shopSettings"],
    queryFn: () => shopApi.getSettings(),
  });

  const [shopName, setShopName] = useState("");
  const [upiVpa, setUpiVpa] = useState("");
  const [upiPayeeName, setUpiPayeeName] = useState("");
  const [upiQrUrl, setUpiQrUrl] = useState("");
  const [deliveryFeeStr, setDeliveryFeeStr] = useState("");
  const [freeDeliveryAboveStr, setFreeDeliveryAboveStr] = useState("");
  const [codLimitStr, setCodLimitStr] = useState("");
  const [acceptingOrders, setAcceptingOrders] = useState(true);

  // Populate form from fetched settings
  useEffect(() => {
    const s = settingsQuery.data;
    if (!s) return;
    setShopName(s.shopName ?? "");
    setUpiVpa(s.upiVpa ?? "");
    setUpiPayeeName(s.upiPayeeName ?? "");
    setUpiQrUrl(s.upiQrUrl ?? "");
    setDeliveryFeeStr(formatRupees(s.deliveryFeePaise));
    setFreeDeliveryAboveStr(formatRupees(s.freeDeliveryAbovePaise));
    setCodLimitStr(formatRupees(s.codLimitPaise));
    setAcceptingOrders(s.acceptingOrders);
  }, [settingsQuery.data]);

  const saveSettings = useMutation({
    mutationFn: () =>
      paymentApi.updateSettings({
        shopName: shopName || undefined,
        upiVpa: upiVpa || undefined,
        upiPayeeName: upiPayeeName || undefined,
        upiQrUrl: upiQrUrl || undefined,
        deliveryFeePaise: parsePaise(deliveryFeeStr) || undefined,
        freeDeliveryAbovePaise: parsePaise(freeDeliveryAboveStr) || undefined,
        codLimitPaise: parsePaise(codLimitStr) || undefined,
        acceptingOrders,
      }),
    onSuccess: () => {
      Alert.alert("", t("admin.settings.success"));
      settingsQuery.refetch();
    },
    onError: () => {
      Alert.alert(t("common.somethingWrong"), t("admin.settings.error"));
    },
  });

  if (settingsQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#C8912F" />
      </SafeAreaView>
    );
  }

  if (settingsQuery.isError) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper gap-3 px-gutter">
        <Text className="font-anek text-body text-ink-soft">
          {t("admin.settings.loading")}
        </Text>
        <Pressable onPress={() => settingsQuery.refetch()}>
          <Text className="font-anek-medium text-body text-enamel">
            {t("common.retry")}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1" contentContainerClassName="pb-12">
        {/* Header */}
        <View className="flex-row items-center px-gutter pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70"
          >
            <Text className="font-anek-medium text-caption text-ink">←</Text>
          </Pressable>
          <Text className="font-anek-semibold text-h2 text-enamel">
            {t("admin.settings.title")}
          </Text>
        </View>

        {/* Shop Name */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.shopName")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
            value={shopName}
            onChangeText={setShopName}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* UPI VPA */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.upiVpa")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-mono text-body text-ink"
            value={upiVpa}
            onChangeText={setUpiVpa}
            placeholder={t("admin.settings.upiVpaPlaceholder")}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* UPI Payee Name */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.upiPayeeName")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
            value={upiPayeeName}
            onChangeText={setUpiPayeeName}
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* UPI QR URL */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.upiQrUrl")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
            value={upiQrUrl}
            onChangeText={setUpiQrUrl}
            placeholderTextColor="#9CA3AF"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {/* Divider */}
        <View className="mx-gutter my-4 border-t border-ruled" />

        {/* Delivery Fee */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.deliveryFeePaise")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-mono text-body text-ink"
            value={deliveryFeeStr}
            onChangeText={setDeliveryFeeStr}
            keyboardType="decimal-pad"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Free Delivery Above */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.freeDeliveryAbovePaise")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-mono text-body text-ink"
            value={freeDeliveryAboveStr}
            onChangeText={setFreeDeliveryAboveStr}
            keyboardType="decimal-pad"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* COD Limit */}
        <View className="mx-gutter mb-4">
          <Text className="mb-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.codLimitPaise")}
          </Text>
          <TextInput
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-mono text-body text-ink"
            value={codLimitStr}
            onChangeText={setCodLimitStr}
            keyboardType="decimal-pad"
            placeholderTextColor="#9CA3AF"
          />
        </View>

        {/* Accepting Orders toggle */}
        <View className="mx-gutter mb-6 flex-row items-center justify-between rounded-card border border-ruled bg-surface p-4">
          <Text className="flex-1 font-anek-medium text-caption text-ink">
            {t("admin.settings.isAcceptingOrders")}
          </Text>
          <Switch
            value={acceptingOrders}
            onValueChange={setAcceptingOrders}
            trackColor={{ false: "#D1D5DB", true: "#C8912F" }}
            thumbColor="#FFFFFF"
          />
        </View>

        {/* Save button */}
        <View className="mx-gutter">
          <Pressable
            onPress={() => saveSettings.mutate()}
            disabled={saveSettings.isPending}
            className="items-center rounded-chip bg-enamel py-3 disabled:opacity-50"
          >
            <Text className="font-anek-semibold text-body text-paper">
              {saveSettings.isPending
                ? t("admin.settings.saving")
                : t("admin.settings.save")}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
