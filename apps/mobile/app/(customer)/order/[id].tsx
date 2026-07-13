import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { OrderDto, StatusEventDto } from "@kss/shared";
import { orderApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function statusLabel(t: (key: string) => string, status: string): string {
  const key = `customer.orders.status${status.charAt(0).toUpperCase() + status.slice(1)}`;
  const fallback: Record<string, string> = {
    placed: "Placed",
    payment_pending_verification: "Pending Payment",
    payment_failed: "Payment Failed",
    confirmed: "Confirmed",
    packed: "Packed",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    returned: "Returned",
  };
  return t(key) !== key ? t(key) : fallback[status] ?? status;
}

function statusColor(status: string): string {
  switch (status) {
    case "delivered":
      return "bg-forest";
    case "cancelled":
    case "returned":
      return "bg-chilli";
    case "out_for_delivery":
      return "bg-brass";
    default:
      return "bg-turmeric";
  }
}

function statusIcon(status: string): string {
  switch (status) {
    case "placed":
      return "📝";
    case "payment_pending_verification":
      return "⏳";
    case "payment_failed":
      return "❌";
    case "confirmed":
      return "✅";
    case "packed":
      return "📦";
    case "out_for_delivery":
      return "🚚";
    case "delivered":
      return "🎉";
    case "cancelled":
      return "🚫";
    case "returned":
      return "↩️";
    default:
      return "●";
  }
}

function StatusTimeline({ events }: { events: StatusEventDto[] }) {
  const { t } = useTranslation();

  if (!events || events.length === 0) return null;

  return (
    <View className="rounded-card border border-ruled bg-surface p-4">
      <Text className="mb-4 font-anek-semibold text-h2 text-ink">
        {t("customer.orders.timeline")}
      </Text>

      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        const date = new Date(event.createdAt).toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

        return (
          <View key={`${event.status}-${idx}`} className="flex-row">
            {/* Timeline line + dot */}
            <View className="mr-3 items-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full ${statusColor(event.status)}`}
              >
                <Text className="text-sm">{statusIcon(event.status)}</Text>
              </View>
              {!isLast && <View className="mt-1 h-full w-0.5 flex-1 bg-ruled" />}
            </View>

            {/* Event content */}
            <View className={`flex-1 pb-6 ${isLast ? "" : ""}`}>
              <Text className="font-anek-semibold text-body text-ink">
                {statusLabel(t, event.status)}
              </Text>
              <Text className="font-anek text-caption-xs text-ink-soft">{date}</Text>
              {event.note && (
                <Text className="mt-1 font-anek text-caption text-ink-soft italic">
                  {event.note}
                </Text>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
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

  const order = query.data as OrderDto | undefined;

  if (query.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="font-anek text-body text-ink-soft">{t("customer.orders.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (query.isError || !order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper gap-3 px-gutter">
        <Text className="font-anek text-body text-ink-soft">{t("customer.orders.error")}</Text>
        <Pressable onPress={() => query.refetch()}>
          <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const statusIsFinal = ["delivered", "cancelled", "returned"].includes(order.status);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1">
        {/* Success header for newly placed orders */}
        {order.status === "placed" || order.status === "confirmed" ? (
          <View className="items-center px-gutter pt-8 pb-6">
            <Text className="mb-2 text-6xl">🎉</Text>
            <Text className="font-anek-semibold text-h1 text-forest">
              {t("customer.orders.placed")}
            </Text>
            <Text className="mt-1 font-anek text-body text-ink-soft">
              {t("customer.orders.orderNumber", { number: order.orderNumber })}
            </Text>
            <View className="mt-1 rounded-chip bg-brass-tint px-3 py-1">
              <Text className="font-anek-medium text-caption text-enamel">
                {statusLabel(t, order.status)}
              </Text>
            </View>
          </View>
        ) : (
          /* Header for existing orders */
          <View className="flex-row items-center px-gutter pt-2 pb-4">
            <Pressable onPress={() => router.back()} className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
              <Text className="font-anek-medium text-caption text-ink">←</Text>
            </Pressable>
            <View className="flex-1">
              <Text className="font-anek-semibold text-h2 text-enamel" numberOfLines={1}>
                {t("customer.orders.orderNumber", { number: order.orderNumber })}
              </Text>
              <Text className="font-anek text-caption text-ink-soft">
                {new Date(order.placedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Text>
            </View>
            <View className={`rounded-chip px-3 py-1 ${statusIsFinal ? "bg-surface border border-ruled" : "bg-brass-tint"}`}>
              <Text className={`font-anek-medium text-caption ${statusIsFinal ? "text-ink-soft" : "text-enamel"}`}>
                {statusLabel(t, order.status)}
              </Text>
            </View>
          </View>
        )}

        {/* Items */}
        <View className="mx-gutter mb-6 rounded-card border border-ruled bg-surface p-4">
          <Text className="mb-3 font-anek-semibold text-h2 text-ink">
            {t("customer.checkout.orderSummary")}
          </Text>

          {order.items.map((it: any) => {
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
                    {it.packLabel} × {it.quantity}
                  </Text>
                </View>
                <Text className="font-mono text-price text-ink">
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
            <Text className="font-mono text-caption text-ink">
              {order.deliveryFeePaise === 0
                ? t("customer.checkout.freeDelivery")
                : formatRupees(order.deliveryFeePaise)}
            </Text>
          </View>
          <View className="my-2 border-t border-ruled" />
          <View className="flex-row justify-between">
            <Text className="font-anek-semibold text-body text-ink">{t("customer.checkout.total")}</Text>
            <Text className="font-mono text-h2 text-brass">{formatRupees(order.totalPaise)}</Text>
          </View>
        </View>

        {/* Status Timeline */}
        {order.statusEvents && order.statusEvents.length > 0 && (
          <View className="mx-gutter mb-6">
            <StatusTimeline events={order.statusEvents} />
          </View>
        )}

        {/* Actions */}
        {!statusIsFinal && (
          <View className="mx-gutter mb-8 gap-3">
            {/* Pay Now — shown for payment_pending_verification or payment_failed */}
            {(order.status === "payment_pending_verification" || order.status === "payment_failed") && (
              <Link href={`/customer/pay/${order.id}`} asChild>
                <Pressable className="items-center rounded-chip bg-brass py-3 active:opacity-80">
                  <Text className="font-anek-semibold text-body text-paper">
                    {t("customer.checkout.upi")}
                  </Text>
                </Pressable>
              </Link>
            )}
            <Link href="../" asChild>
              <Pressable className="items-center rounded-chip bg-enamel py-3 active:opacity-80">
                <Text className="font-anek-semibold text-body text-paper">
                  {t("customer.orders.continueShopping")}
                </Text>
              </Pressable>
            </Link>
          </View>
        )}

        {/* Bottom padding */}
        <View className="h-8" />
      </ScrollView>
    </SafeAreaView>
  );
}
