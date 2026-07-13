import { useMemo } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { orderApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "delivered":
      return "text-forest";
    case "cancelled":
    case "returned":
      return "text-chilli";
    case "out_for_delivery":
      return "text-brass";
    default:
      return "text-turmeric";
  }
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

function OrderRow({
  order,
}: {
  order: {
    id: string;
    orderNumber: string;
    status: string;
    totalPaise: number;
    placedAt: string;
    itemCount?: number;
  };
}) {
  const { t } = useTranslation();

  const date = new Date(order.placedAt).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <Link href={`./order/${order.id}`} asChild>
      <Pressable className="flex-row items-center justify-between rounded-card border border-ruled bg-surface px-gutter py-4 active:opacity-70">
        <View className="flex-1 gap-1 pr-3">
          <View className="flex-row items-center gap-2">
            <Text className="font-mono text-caption text-ink-soft">
              {t("customer.orders.orderNumber", { number: order.orderNumber })}
            </Text>
          </View>
          <Text className="font-anek-semibold text-body-lg text-enamel">
            {formatRupees(order.totalPaise)}
          </Text>
          <Text className="font-anek text-caption-xs text-ink-soft">{date}</Text>
        </View>
        <View className="items-end gap-1">
          <Text className={`font-anek-medium text-caption ${statusColor(order.status)}`}>
            {statusLabel(t, order.status)}
          </Text>
          <Text className="text-lg text-brass">›</Text>
        </View>
      </Pressable>
    </Link>
  );
}

export default function OrdersListScreen() {
  const { t } = useTranslation();

  const query = useInfiniteQuery({
    queryKey: ["customer", "orders"],
    queryFn: ({ pageParam }) => orderApi.list(pageParam ?? undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const orders = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center px-gutter pt-2 pb-3">
        <Pressable onPress={() => router.back()} className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
          <Text className="font-anek-medium text-caption text-ink">←</Text>
        </Pressable>
        <Text className="font-anek-semibold text-h2 text-enamel">
          {t("customer.orders.title")}
        </Text>
      </View>

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8912F" />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="font-anek text-body text-ink-soft">{t("customer.orders.error")}</Text>
          <Pressable onPress={() => query.refetch()}>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="text-4xl">📋</Text>
          <Text className="font-anek text-body text-ink-soft">{t("customer.orders.empty")}</Text>
          <Link href="../" asChild>
            <Pressable className="rounded-chip bg-enamel px-6 py-3">
              <Text className="font-anek-semibold text-body text-paper">
                {t("customer.orders.emptyCTA")}
              </Text>
            </Pressable>
          </Link>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o: any) => o.id}
          contentContainerClassName="gap-3 px-gutter pb-8"
          renderItem={({ item }) => <OrderRow order={item} />}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => query.refetch()}
            />
          }
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator color="#C8912F" />
              </View>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
