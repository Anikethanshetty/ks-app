import { useEffect } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import type { CartItemDto } from "@kss/shared";
import { useCartStore } from "@/lib/cartStore";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function CartItemRow({ item }: { item: CartItemDto }) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const updateItem = useCartStore((s) => s.updateItem);
  const removeItem = useCartStore((s) => s.removeItem);

  const name =
    lang === "kn"
      ? item.productNameKn
      : lang === "hi"
        ? item.productNameHi
        : item.productNameEn;

  const lineTotal = item.quantity * item.sellingPricePaise;

  return (
    <View className="flex-row items-center justify-between border-b border-ruled px-gutter py-4">
      <View className="flex-1 gap-1 pr-3">
        <Text className="font-anek-medium text-body-lg text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="font-anek text-caption text-ink-soft">
          {item.packLabel} · {formatRupees(item.sellingPricePaise)}/unit
        </Text>
      </View>

      <View className="items-end gap-2">
        {/* Quantity stepper */}
        <View className="flex-row items-center gap-2">
          <Pressable
            onPress={() => {
              if (item.quantity <= 1) {
                removeItem(item.id);
              } else {
                updateItem(item.id, item.quantity - 1);
              }
            }}
            className="h-8 w-8 items-center justify-center rounded-full bg-enamel active:opacity-70"
          >
            <Text className="font-anek-semibold text-body text-paper">{item.quantity <= 1 ? "🗑" : "−"}</Text>
          </Pressable>

          <Text className="min-w-[24px] text-center font-mono text-body text-ink">
            {item.quantity}
          </Text>

          <Pressable
            onPress={() => updateItem(item.id, item.quantity + 1)}
            className="h-8 w-8 items-center justify-center rounded-full bg-enamel active:opacity-70"
          >
            <Text className="font-anek-semibold text-body text-paper">+</Text>
          </Pressable>
        </View>

        <Text className="font-mono text-price text-brass">
          {formatRupees(lineTotal)}
        </Text>
      </View>
    </View>
  );
}

export default function CartScreen() {
  const { t } = useTranslation();
  const fetchCart = useCartStore((s) => s.fetchCart);
  const items = useCartStore((s) => s.items);
  const subtotalPaise = useCartStore((s) => s.subtotalPaise);
  const loading = useCartStore((s) => s.loading);
  const error = useCartStore((s) => s.error);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  // Recalculate subtotal from current items
  const computedSubtotal = items.reduce(
    (sum, it) => sum + it.quantity * it.sellingPricePaise,
    0,
  );

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center px-gutter pt-2 pb-3">
        <Link href="../" asChild>
          <Pressable className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
            <Text className="font-anek-medium text-caption text-ink">← {t("customer.home.title")}</Text>
          </Pressable>
        </Link>
        <Text className="font-anek-semibold text-h2 text-enamel">
          {t("customer.cart.title")}
        </Text>
      </View>

      {loading && items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-anek text-body text-ink-soft">{t("customer.cart.loading")}</Text>
        </View>
      ) : error && items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="font-anek text-body text-ink-soft">{t("common.somethingWrong")}</Text>
          <Pressable onPress={fetchCart}>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-2 px-gutter">
          <Text className="text-4xl">🛒</Text>
          <Text className="font-anek text-body text-ink-soft">{t("customer.cart.empty")}</Text>
          <Text className="font-anek text-caption text-ink-soft">{t("customer.cart.emptyHint")}</Text>
          <Link href="../" asChild>
            <Pressable className="mt-4 rounded-chip bg-enamel px-6 py-3">
              <Text className="font-anek-semibold text-body text-paper">
                {t("customer.home.browse")}
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <>
          <FlatList
            data={items}
            keyExtractor={(it) => it.id}
            renderItem={({ item }) => <CartItemRow item={item} />}
          />

          {/* Bottom bar with subtotal + checkout */}
          <View className="border-t border-ruled bg-surface px-gutter py-4">
            <View className="mb-3 flex-row items-center justify-between">
              <Text className="font-anek text-body text-ink-soft">
                {t("customer.cart.subtotal")} ({items.length} {t("customer.cart.itemCount", { count: items.length })})
              </Text>
              <Text className="font-mono text-h2 text-brass">
                {formatRupees(computedSubtotal)}
              </Text>
            </View>

            <Link href="/customer/checkout" asChild>
              <Pressable className="items-center rounded-chip bg-enamel py-3 active:opacity-80">
                <Text className="font-anek-semibold text-body text-paper">
                  {t("customer.cart.checkout")} · {formatRupees(computedSubtotal)}
                </Text>
              </Pressable>
            </Link>
          </View>
        </>
      )}
    </SafeAreaView>
  );
}
