import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AddressDto, OrderPreviewDto } from "@kss/shared";
import { addressApi, orderApi, shopApi } from "@/lib/endpoints";
import { useCartStore } from "@/lib/cartStore";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function AddressSelector({
  addresses,
  selectedId,
  onSelect,
  onAddNew,
}: {
  addresses: AddressDto[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddNew: () => void;
}) {
  const { t } = useTranslation();

  return (
    <View>
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-anek-semibold text-h2 text-ink">{t("customer.checkout.selectAddress")}</Text>
        <Pressable onPress={onAddNew} className="active:opacity-70">
          <Text className="font-anek-medium text-caption text-brass">{t("customer.checkout.addAddress")}</Text>
        </Pressable>
      </View>

      {addresses.length === 0 ? (
        <Text className="font-anek text-caption text-ink-soft">{t("customer.address.empty")}</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-3">
          {addresses.map((addr) => {
            const selected = addr.id === selectedId;
            const lines = [addr.label, addr.line1, addr.area, addr.city]
              .filter(Boolean)
              .join(", ");
            return (
              <Pressable
                key={addr.id}
                onPress={() => onSelect(addr.id)}
                className={`mr-3 w-72 rounded-card border p-4 ${
                  selected ? "border-brass bg-brass-tint" : "border-ruled bg-surface"
                }`}
              >
                {addr.label && (
                  <Text className="mb-1 font-anek-medium text-caption text-ink">{addr.label}</Text>
                )}
                <Text className="font-anek text-caption text-ink-soft" numberOfLines={2}>
                  {lines}
                </Text>
                {selected && (
                  <Text className="mt-2 font-anek text-caption-xs text-forest">✓ {t("customer.checkout.changeAddress")}</Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

function BillSummary({ preview }: { preview: OrderPreviewDto }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  return (
    <View className="rounded-card border border-ruled bg-surface p-4">
      <Text className="mb-3 font-anek-semibold text-h2 text-ink">{t("customer.checkout.orderSummary")}</Text>

      {/* Items */}
      {preview.items.map((item) => {
        const name = lang === "kn" ? item.productNameKn : lang === "hi" ? item.productNameHi : item.productNameEn;
        return (
          <View key={item.variantId} className="mb-2 flex-row justify-between">
            <View className="flex-1 pr-2">
              <Text className="font-anek text-caption text-ink" numberOfLines={1}>
                {name}
              </Text>
              <Text className="font-anek text-caption-xs text-ink-soft">
                {item.packLabel} × {item.quantity}
              </Text>
            </View>
            <Text className="font-mono text-price text-ink">
              {formatRupees(item.lineTotalPaise)}
            </Text>
          </View>
        );
      })}

      <View className="my-3 border-t border-ruled" />

      {/* Subtotal */}
      <View className="mb-2 flex-row justify-between">
        <Text className="font-anek text-caption text-ink-soft">{t("customer.checkout.subtotal")}</Text>
        <Text className="font-mono text-caption text-ink">{formatRupees(preview.subtotalPaise)}</Text>
      </View>

      {/* Delivery fee */}
      <View className="mb-2 flex-row justify-between">
        <Text className="font-anek text-caption text-ink-soft">{t("customer.checkout.deliveryFee")}</Text>
        <Text className="font-mono text-caption text-ink">
          {preview.deliveryFeePaise === 0
            ? t("customer.checkout.freeDelivery")
            : formatRupees(preview.deliveryFeePaise)}
        </Text>
      </View>

      {preview.deliveryFeePaise > 0 && (
        <Text className="mb-2 font-anek text-caption-xs text-ink-soft">
          {t("customer.checkout.freeDeliveryAbove", {
            amount: formatRupees(preview.freeDeliveryAbovePaise).replace("₹", ""),
          })}
        </Text>
      )}

      <View className="my-2 border-t border-ruled" />

      {/* Total */}
      <View className="flex-row justify-between">
        <Text className="font-anek-semibold text-body text-ink">{t("customer.checkout.total")}</Text>
        <Text className="font-mono text-h2 text-brass">{formatRupees(preview.totalPaise)}</Text>
      </View>

      {/* COD warning */}
      {preview.codExceeded && (
        <View className="mt-3 rounded-chip bg-turmeric-tint px-3 py-2">
          <Text className="font-anek text-caption text-ink">
            {t("customer.checkout.codLimitExceeded", {
              limit: formatRupees(preview.codLimitPaise).replace("₹", ""),
            })}
          </Text>
        </View>
      )}

      {/* Out of stock warning */}
      {preview.items.some((i) => !i.inStock) && (
        <View className="mt-2 rounded-chip bg-chilli-tint px-3 py-2">
          <Text className="font-anek text-caption text-paper">
            {t("customer.checkout.outOfStockItems")}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function CheckoutScreen() {
  const { t } = useTranslation();
  const fetchCart = useCartStore((s) => s.fetchCart);
  const items = useCartStore((s) => s.items);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);

  // Fetch addresses
  const addressesQuery = useQuery({
    queryKey: ["addresses"],
    queryFn: () => addressApi.list(),
  });

  const addresses = addressesQuery.data?.items ?? [];

  // Auto-select first/default address
  useEffect(() => {
    if (!selectedAddressId && addresses.length > 0) {
      const defaultAddr = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (defaultAddr) setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // Fetch order preview when address is selected
  const previewQuery = useQuery({
    queryKey: ["orderPreview", selectedAddressId],
    queryFn: () => orderApi.preview(selectedAddressId!),
    enabled: !!selectedAddressId,
  });

  const preview = previewQuery.data;

  // Place order mutation
  const placeOrder = useMutation({
    mutationFn: () =>
      orderApi.place({
        addressId: selectedAddressId!,
        paymentMethod: "cod",
      }),
    onSuccess: (order) => {
      fetchCart(); // Refresh cart (now empty)
      router.replace(`/customer/order/${order.id}`);
    },
    onError: (err: any) => {
      const code = err?.code ?? "INTERNAL_ERROR";
      const messages: Record<string, string> = {
        EMPTY_ORDER: t("customer.checkout.emptyCart"),
        INVALID_ADDRESS: t("customer.checkout.invalidAddress"),
        OUT_OF_STOCK: t("customer.checkout.outOfStockItems"),
        COD_LIMIT_EXCEEDED: t("customer.checkout.codLimitExceeded", {
          limit: preview ? formatRupees(preview.codLimitPaise).replace("₹", "") : "",
        }),
        SHOP_NOT_ACCEPTING_ORDERS: t("customer.checkout.shopClosed"),
      };
      Alert.alert(t("common.somethingWrong"), messages[code] ?? t("customer.checkout.error"));
    },
  });

  const canPlace = !!selectedAddressId && preview && !preview.codExceeded && preview.isAcceptingOrders && preview.items.every((i) => i.inStock);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center px-gutter pt-2 pb-3">
        <Link href="../cart" asChild>
          <Pressable className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
            <Text className="font-anek-medium text-caption text-ink">←</Text>
          </Pressable>
        </Link>
        <Text className="font-anek-semibold text-h2 text-enamel">{t("customer.checkout.title")}</Text>
      </View>

      {addressesQuery.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8912F" />
        </View>
      ) : (
        <ScrollView className="flex-1 px-gutter">
          {/* Address selector */}
          <View className="mb-6">
            <AddressSelector
              addresses={addresses}
              selectedId={selectedAddressId}
              onSelect={setSelectedAddressId}
              onAddNew={() => router.push("/customer/addresses")}
            />
          </View>

          {/* Loading preview */}
          {previewQuery.isFetching && (
            <View className="items-center justify-center py-8">
              <Text className="font-anek text-body text-ink-soft">{t("customer.checkout.loading")}</Text>
            </View>
          )}

          {/* Error */}
          {previewQuery.isError && !previewQuery.isFetching && (
            <View className="items-center justify-center py-8">
              <Text className="font-anek text-body text-chilli">{t("customer.checkout.error")}</Text>
            </View>
          )}

          {/* Bill summary */}
          {preview && <BillSummary preview={preview} />}
        </ScrollView>
      )}

      {/* Bottom action bar */}
      <View className="border-t border-ruled bg-surface px-gutter py-4">
        <Pressable
          onPress={() => placeOrder.mutate()}
          disabled={!canPlace || placeOrder.isPending}
          className="items-center rounded-chip bg-enamel py-3 disabled:opacity-50"
        >
          <Text className="font-anek-semibold text-body text-paper">
            {placeOrder.isPending
              ? t("customer.checkout.placing")
              : `${t("customer.checkout.placeOrder")} · ${preview ? formatRupees(preview.totalPaise) : ""}`}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
