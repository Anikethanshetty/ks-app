import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { inventoryApi } from "@/lib/endpoints";

type AdjustMode = "stock_in" | "stock_out" | "correction";

/** A07 Stock adjust bottom sheet. Launched from the inventory list or product edit. */
export default function StockAdjustScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { variantId, productId } = useLocalSearchParams<{
    variantId: string;
    productId: string;
  }>();

  const [mode, setMode] = useState<AdjustMode>("stock_in");
  const [quantity, setQuantity] = useState("");
  const [countedStock, setCountedStock] = useState("");
  const [reason, setReason] = useState("damage");
  const [note, setNote] = useState("");

  const adjustMutation = useMutation({
    mutationFn: async () => {
      const qty = Number(quantity) || 0;

      if (mode === "stock_in") {
        return inventoryApi.adjustStock({
          type: "stock_in",
          variantId,
          quantity: qty,
          note: note || undefined,
        } as any);
      }
      if (mode === "stock_out") {
        return inventoryApi.adjustStock({
          type: "stock_out",
          variantId,
          quantity: qty,
          reason: reason as "damage" | "expiry" | "shop_use",
          note: note || undefined,
        } as any);
      }
      return inventoryApi.adjustStock({
        type: "correction",
        variantId,
        countedStock: Number(countedStock) || 0,
        note: note || undefined,
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
      if (productId) {
        queryClient.invalidateQueries({ queryKey: ["admin", "product", productId] });
      }
      Alert.alert(t("admin.stockAdjust.success"));
      router.back();
    },
    onError: (err: any) => {
      if (err?.code === "OUT_OF_STOCK") {
        Alert.alert(t("admin.stockAdjust.outOfStock"));
      } else {
        Alert.alert(t("admin.stockAdjust.error"));
      }
    },
  });

  const handleSubmit = useCallback(() => {
    if (mode !== "correction") {
      if (!quantity || Number(quantity) <= 0) {
        Alert.alert(t("common.required"));
        return;
      }
    } else {
      if (countedStock === "") {
        Alert.alert(t("common.required"));
        return;
      }
    }
    adjustMutation.mutate();
  }, [mode, quantity, countedStock, adjustMutation, t]);

  const STOCK_OUT_REASONS: Array<{ key: string; label: string }> = [
    { key: "damage", label: t("admin.stockAdjust.reasonDamage") },
    { key: "expiry", label: t("admin.stockAdjust.reasonExpiry") },
    { key: "shop_use", label: t("admin.stockAdjust.reasonShopUse") },
  ];

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView className="flex-1" contentContainerClassName="px-gutter pb-32">
          {/* Header with mode tabs */}
          <View className="py-4">
            <Text className="font-anek-semibold text-h1 text-enamel">
              {t("admin.stockAdjust.title")}
            </Text>
          </View>

          <View className="flex-row gap-2 pb-4">
            {(["stock_in", "stock_out", "correction"] as AdjustMode[]).map((m) => (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                className={`rounded-chip px-4 py-2 ${
                  mode === m ? "bg-enamel" : "border border-ruled"
                }`}
              >
                <Text
                  className={`font-anek-medium text-caption ${
                    mode === m ? "text-paper" : "text-ink-soft"
                  }`}
                >
                  {t(`admin.stockAdjust.${m}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Stock In */}
          {mode === "stock_in" && (
            <View className="gap-4">
              <Text className="font-anek text-caption text-ink-soft">
                {t("admin.product.sku")}: {variantId}
              </Text>
              <FormField
                label={t("admin.stockAdjust.quantity")}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="e.g. 50"
              />
              <FormField
                label={t("admin.stockAdjust.note")}
                value={note}
                onChangeText={setNote}
                placeholder={t("admin.stockAdjust.notePlaceholder")}
              />
            </View>
          )}

          {/* Stock Out */}
          {mode === "stock_out" && (
            <View className="gap-4">
              <Text className="font-anek text-caption text-ink-soft">
                {t("admin.product.sku")}: {variantId}
              </Text>
              <FormField
                label={t("admin.stockAdjust.quantity")}
                value={quantity}
                onChangeText={setQuantity}
                keyboardType="numeric"
                placeholder="e.g. 10"
              />

              <View className="gap-2">
                <Text className="font-anek-medium text-caption text-ink-soft">
                  {t("admin.stockAdjust.reason")}
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  {STOCK_OUT_REASONS.map((r) => {
                    const active = reason === r.key;
                    return (
                      <Pressable
                        key={r.key}
                        onPress={() => setReason(r.key)}
                        className={`rounded-chip px-4 py-2 ${
                          active ? "bg-chilli" : "border border-ruled"
                        }`}
                      >
                        <Text
                          className={`font-anek-medium text-caption ${
                            active ? "text-paper" : "text-ink-soft"
                          }`}
                        >
                          {r.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>

              <FormField
                label={t("admin.stockAdjust.note")}
                value={note}
                onChangeText={setNote}
                placeholder={t("admin.stockAdjust.notePlaceholder")}
              />
            </View>
          )}

          {/* Correction */}
          {mode === "correction" && (
            <View className="gap-4">
              <Text className="font-anek text-caption text-ink-soft">
                {t("admin.product.sku")}: {variantId}
              </Text>
              <FormField
                label={t("admin.stockAdjust.countedStock")}
                value={countedStock}
                onChangeText={setCountedStock}
                keyboardType="numeric"
                placeholder="e.g. 100"
              />
              <FormField
                label={t("admin.stockAdjust.note")}
                value={note}
                onChangeText={setNote}
                placeholder={t("admin.stockAdjust.notePlaceholder")}
              />
            </View>
          )}
        </ScrollView>

        {/* ── Submit button ── */}
        <View className="border-t border-ruled bg-paper px-gutter py-4">
          <Pressable
            onPress={handleSubmit}
            disabled={adjustMutation.isPending}
            className={`h-14 items-center justify-center rounded-button ${
              adjustMutation.isPending ? "bg-enamel/60" : "bg-enamel"
            }`}
          >
            {adjustMutation.isPending ? (
              <ActivityIndicator color="#FBFAF6" />
            ) : (
              <Text className="font-anek-semibold text-body-lg text-paper">
                {t("admin.stockAdjust.submit")}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  keyboardType,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  keyboardType?: "default" | "numeric" | "url";
}) {
  return (
    <View className="gap-1.5">
      {label && (
        <Text className="font-anek-medium text-caption text-ink-soft">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6A6E67"
        keyboardType={keyboardType}
        className={`rounded-button border bg-paper px-4 py-3 font-anek text-body-lg text-ink ${
          error ? "border-chilli" : "border-ruled"
        }`}
      />
      {error && <Text className="font-anek text-caption text-chilli">{error}</Text>}
    </View>
  );
}
