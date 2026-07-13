import React, { useState } from "react";
import {
  Alert,
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { OrderDto } from "@kss/shared";
import { adminOrderApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "delivered": return "text-forest";
    case "cancelled": case "returned": return "text-chilli";
    default: return "text-brass";
  }
}

function statusBg(status: string): string {
  switch (status) {
    case "delivered": return "bg-forest";
    case "cancelled": case "returned": return "bg-chilli";
    default: return "bg-brass";
  }
}

const NEXT_ACTIONS: Record<string, { status: string; labelKey: string }[]> = {
  placed: [
    { status: "confirmed", labelKey: "confirmOrder" },
  ],
  payment_pending_verification: [
    { status: "confirmed", labelKey: "confirmOrder" },
  ],
  confirmed: [
    { status: "packed", labelKey: "packOrder" },
    { status: "cancelled", labelKey: "cancelOrder" },
  ],
  packed: [
    { status: "out_for_delivery", labelKey: "markOutForDelivery" },
    { status: "cancelled", labelKey: "cancelOrder" },
  ],
  out_for_delivery: [
    { status: "delivered", labelKey: "markDelivered" },
  ],
};

export default function AdminOrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const queryClient = useQueryClient();
  const [cancelNote, setCancelNote] = useState("");

  const query = useQuery({
    queryKey: ["admin", "order", id],
    queryFn: () => adminOrderApi.get(id!),
    enabled: !!id,
  });

  const order = query.data as OrderDto | undefined;

  const statusMutation = useMutation({
    mutationFn: ({ status, note }: { status: string; note?: string }) =>
      adminOrderApi.updateStatus(id!, status, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "order", id] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "counts"] });
      query.refetch();
    },
    onError: () => {
      Alert.alert(t("common.somethingWrong"), t("admin.orders.actionError"));
    },
  });

  if (query.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#C8912F" />
      </SafeAreaView>
    );
  }

  if (query.isError || !order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper gap-3 px-gutter">
        <Text className="font-anek text-body text-ink-soft">{t("common.somethingWrong")}</Text>
        <Pressable onPress={() => router.back()}>
          <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const nextActions = NEXT_ACTIONS[order.status] ?? [];

  const handleAction = (status: string) => {
    if (status === "cancelled") {
      Alert.alert(t("admin.orders.cancelOrder"), t("admin.orders.cancelNote"), [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("admin.orders.cancelConfirm"),
          style: "destructive",
          onPress: () => statusMutation.mutate({ status, note: cancelNote || undefined }),
        },
      ]);
    } else {
      statusMutation.mutate({ status });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-gutter pt-2 pb-4">
          <Pressable onPress={() => router.back()} className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
            <Text className="font-anek-medium text-caption text-ink">←</Text>
          </Pressable>
          <View className="flex-1">
            <Text className="font-anek-semibold text-h2 text-enamel" numberOfLines={1}>
              {t("admin.orders.orderNumber", { number: order.orderNumber })}
            </Text>
            <Text className={`font-anek-medium text-caption ${statusColor(order.status)}`}>
              {order.status.replace(/_/g, " ")}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <View className="mx-gutter mb-4 rounded-card border border-ruled bg-surface p-4">
          <Text className="mb-2 font-anek-semibold text-h2 text-ink">{t("admin.orders.customerInfo")}</Text>
          <Text className="font-anek text-body text-ink">
            {(order as any).user?.fullName ?? "—"}
          </Text>
          <Text className="font-mono text-caption text-ink-soft">
            {(order as any).user?.phone ?? "—"}
          </Text>
          <Text className="mt-2 font-anek text-caption text-ink-soft">
            {t("admin.orders.paymentMethod")}: {order.paymentMethod === "cod" ? t("customer.checkout.cod") : t("customer.checkout.upi")}
          </Text>
          <Text className="font-anek text-caption text-ink-soft">
            {t("customer.orders.placedAt", { date: new Date(order.placedAt).toLocaleString("en-IN") })}
          </Text>
        </View>

        {/* Items */}
        <View className="mx-gutter mb-4 rounded-card border border-ruled bg-surface p-4">
          <Text className="mb-3 font-anek-semibold text-h2 text-ink">{t("admin.orders.items")}</Text>

          {order.items.map((it: any) => {
            const name = lang === "kn" ? it.productNameKn : lang === "hi" ? it.productNameHi : it.productNameEn;
            return (
              <View key={it.id} className="mb-2 flex-row justify-between">
                <View className="flex-1 pr-2">
                  <Text className="font-anek text-caption text-ink" numberOfLines={1}>{name}</Text>
                  <Text className="font-anek text-caption-xs text-ink-soft">{it.packLabel} × {it.quantity}</Text>
                </View>
                <Text className="font-mono text-caption text-ink">{formatRupees(it.lineTotalPaise)}</Text>
              </View>
            );
          })}

          <View className="my-2 border-t border-ruled" />
          <View className="flex-row justify-between">
            <Text className="font-anek text-caption text-ink-soft">{t("customer.checkout.subtotal")}</Text>
            <Text className="font-mono text-caption text-ink">{formatRupees(order.subtotalPaise)}</Text>
          </View>
          <View className="mt-1 flex-row justify-between">
            <Text className="font-anek text-caption text-ink-soft">{t("customer.checkout.deliveryFee")}</Text>
            <Text className="font-mono text-caption text-ink">{formatRupees(order.deliveryFeePaise)}</Text>
          </View>
          <View className="my-2 border-t border-ruled" />
          <View className="flex-row justify-between">
            <Text className="font-anek-semibold text-body text-ink">{t("customer.checkout.total")}</Text>
            <Text className="font-mono text-h2 text-brass">{formatRupees(order.totalPaise)}</Text>
          </View>
        </View>

        {/* Actions */}
        {nextActions.length > 0 && (
          <View className="mx-gutter mb-6 gap-3">
            {nextActions.map((action) => (
              <View key={action.status}>
                {action.status === "cancelled" && (
                  <TextInput
                    value={cancelNote}
                    onChangeText={setCancelNote}
                    placeholder={t("admin.orders.cancelNote")}
                    className="mb-2 rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
                    multiline
                  />
                )}
                <Pressable
                  onPress={() => handleAction(action.status)}
                  disabled={statusMutation.isPending}
                  className={`items-center rounded-chip py-3 ${
                    action.status === "cancelled" ? "bg-chilli" : "bg-enamel"
                  } disabled:opacity-50`}
                >
                  <Text className="font-anek-semibold text-body text-paper">
                    {statusMutation.isPending ? "…" : t(`admin.orders.${action.labelKey}`)}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Status Timeline */}
        {order.statusEvents && order.statusEvents.length > 0 && (
          <View className="mx-gutter mb-8">
            <Text className="mb-3 font-anek-semibold text-h2 text-ink">{t("customer.orders.timeline")}</Text>
            <View className="rounded-card border border-ruled bg-surface p-4">
              {order.statusEvents.map((event: any, idx: number) => {
                const date = new Date(event.createdAt).toLocaleString("en-IN", {
                  day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                });
                return (
                  <View key={idx} className="mb-3 flex-row items-start last:mb-0">
                    <View className={`mr-3 mt-1.5 h-3 w-3 rounded-full ${statusBg(event.status)}`} />
                    <View className="flex-1">
                      <Text className="font-anek-medium text-caption text-ink">
                        {event.status.replace(/_/g, " ")}
                      </Text>
                      <Text className="font-anek text-caption-xs text-ink-soft">{date}</Text>
                      {event.note && (
                        <Text className="font-anek text-caption text-ink-soft italic">{event.note}</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
