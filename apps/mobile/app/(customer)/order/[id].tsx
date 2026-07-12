import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { orderApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const query = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderApi.get(id!),
    enabled: !!id,
  });

  const order = query.data;

  if (query.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="font-anek text-body text-ink-soft">{t("common.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (query.isError || !order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper gap-3 px-gutter">
        <Text className="font-anek text-body text-ink-soft">{t("common.somethingWrong")}</Text>
        <Link href="../" asChild>
          <Pressable>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </Link>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1">
        {/* Success header */}
        <View className="items-center px-gutter pt-8 pb-6">
          <Text className="mb-2 text-6xl">✅</Text>
          <Text className="font-anek-semibold text-h1 text-forest">{t("customer.orders.placed")}</Text>
          <Text className="mt-1 font-anek text-body text-ink-soft">
            {order.orderNumber}
          </Text>
        </View>

        {/* Order info */}
        <View className="mx-gutter rounded-card border border-ruled bg-surface p-4">
          <View className="mb-3 flex-row justify-between">
            <Text className="font-anek text-caption text-ink-soft">{t("customer.orders.status")}</Text>
            <Text className="font-anek-medium text-caption text-forest">{order.status}</Text>
          </View>

          {order.items.map((it) => {
            const name =
              lang === "kn"
                ? it.productNameKn
                : lang === "hi"
                  ? it.productNameHi
                  : it.productNameEn;
            return (
              <View key={it.id} className="mb-2 flex-row justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-anek text-caption text-ink" numberOfLines={1}>
                    {name}
                  </Text>
                  <Text className="font-anek text-caption-xs text-ink-soft">
                    × {it.quantity} @ {formatRupees(it.unitPricePaise)}/unit
                  </Text>
                </View>
                <Text className="font-mono text-caption text-ink">
                  {formatRupees(it.lineTotalPaise)}
                </Text>
              </View>
            );
          })}

          <View className="my-3 border-t border-ruled" />

          <View className="mb-2 flex-row justify-between">
            <Text className="font-anek text-caption text-ink-soft">{t("customer.checkout.subtotal")}</Text>
            <Text className="font-mono text-caption text-ink">{formatRupees(order.subtotalPaise)}</Text>
          </View>
          <View className="mb-2 flex-row justify-between">
            <Text className="font-anek text-caption text-ink-soft">{t("customer.checkout.deliveryFee")}</Text>
            <Text className="font-mono text-caption text-ink">{formatRupees(order.deliveryFeePaise)}</Text>
          </View>
          <View className="my-2 border-t border-ruled" />
          <View className="flex-row justify-between">
            <Text className="font-anek-semibold text-body text-ink">{t("customer.checkout.total")}</Text>
            <Text className="font-mono text-h2 text-brass">{formatRupees(order.totalPaise)}</Text>
          </View>
        </View>

        {/* Back to home */}
        <View className="px-gutter pt-8 pb-12">
          <Link href="../" asChild>
            <Pressable className="items-center rounded-chip bg-enamel py-3 active:opacity-80">
              <Text className="font-anek-semibold text-body text-paper">
                {t("customer.orders.continueShopping")}
              </Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
