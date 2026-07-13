import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { adminOrderApi } from "@/lib/endpoints";

type OrderTab = "new" | "confirmed" | "packed" | "delivering" | "delivered" | "cancelled" | "pending_payment";

const TAB_LABEL_KEY: Record<OrderTab, string> = {
  new: "tabNew",
  pending_payment: "tabPendingPayment",
  confirmed: "tabConfirmed",
  packed: "tabPacked",
  delivering: "tabDelivering",
  delivered: "tabDelivered",
  cancelled: "tabCancelled",
};

const TABS: { key: OrderTab; apiStatus?: string }[] = [
  { key: "new", apiStatus: "placed" },
  { key: "pending_payment", apiStatus: "payment_pending_verification" },
  { key: "confirmed", apiStatus: "confirmed" },
  { key: "packed", apiStatus: "packed" },
  { key: "delivering", apiStatus: "out_for_delivery" },
  { key: "delivered", apiStatus: "delivered" },
  { key: "cancelled", apiStatus: "cancelled" },
];

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function statusColor(status: string): string {
  switch (status) {
    case "placed":
      return "bg-brass";
    case "payment_pending_verification":
      return "bg-turmeric";
    case "confirmed":
      return "bg-enamel";
    case "packed":
      return "bg-enamel/80";
    case "out_for_delivery":
      return "bg-brass";
    case "delivered":
      return "bg-forest";
    case "cancelled":
      return "bg-chilli/70";
    default:
      return "bg-ink-soft";
  }
}

export default function AdminOrderBoardScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<OrderTab>("new");

  const activeTab = TABS.find((t) => t.key === tab);

  // Fetch order counts for badges
  const countsQuery = useQuery({
    queryKey: ["admin", "orders", "counts"],
    queryFn: () => adminOrderApi.counts(),
    refetchInterval: 30_000,
  });

  // Fetch orders filtered by status
  const query = useInfiniteQuery({
    queryKey: ["admin", "orders", tab],
    queryFn: ({ pageParam }) => adminOrderApi.list(activeTab?.apiStatus, pageParam ?? undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!activeTab,
  });

  const orders = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const counts = countsQuery.data;

  const badgeCount = (tabKey: OrderTab): number => {
    if (!counts) return 0;
    switch (tabKey) {
      case "new": return counts.placed;
      case "pending_payment": return counts.paymentPendingVerification;
      case "confirmed": return counts.confirmed;
      case "packed": return counts.packed;
      case "delivering": return counts.outForDelivery;
      case "delivered": return counts.delivered;
      case "cancelled": return counts.cancelled;
      default: return 0;
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center justify-between px-gutter pt-2 pb-2">
        <Text className="font-anek-semibold text-h1 text-enamel">
          {t("admin.orders.title")}
        </Text>
        <Pressable onPress={() => router.back()}>
          <Text className="font-anek-medium text-caption text-ink-soft">← Back</Text>
        </Pressable>
      </View>

      {/* Tabs */}
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={TABS}
        keyExtractor={(t) => t.key}
        contentContainerClassName="px-gutter py-3 gap-2"
        renderItem={({ item }) => {
          const active = tab === item.key;
          const count = badgeCount(item.key);
          return (
            <Pressable
              key={item.key}
              onPress={() => setTab(item.key)}
              className={`rounded-chip px-4 py-2 ${active ? "bg-enamel" : "border border-ruled bg-paper"}`}
            >
              <Text className={`font-anek-medium text-caption ${active ? "text-paper" : "text-ink-soft"}`}>
                {t(`admin.orders.${TAB_LABEL_KEY[item.key]}`)}{" "}
                {count > 0 && (
                  <Text className={active ? "text-paper/70" : "text-brass"}>
                    ({count})
                  </Text>
                )}
              </Text>
            </Pressable>
          );
        }}
      />

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8912F" />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="font-anek text-body text-ink-soft">{t("admin.orders.error")}</Text>
          <Pressable onPress={() => query.refetch()}>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : orders.length === 0 ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <Text className="font-anek text-body text-ink-soft">{t("admin.orders.empty")}</Text>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o: any) => o.id}
          contentContainerClassName="px-gutter pb-8"
          renderItem={({ item }: { item: any }) => {
            const date = new Date(item.placedAt).toLocaleString("en-IN", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <Pressable
                onPress={() => router.push(`/admin/orders/${item.id}`)}
                className="mb-3 rounded-card border border-ruled bg-surface p-4 active:opacity-70"
              >
                <View className="flex-row items-center justify-between">
                  <Text className="font-mono text-caption text-ink-soft">
                    {t("admin.orders.orderNumber", { number: item.orderNumber })}
                  </Text>
                  <View className={`rounded-sm px-2 py-0.5 ${statusColor(item.status)}`}>
                    <Text className="font-anek-medium text-caption-xs text-paper">
                      {item.status.replace(/_/g, " ")}
                    </Text>
                  </View>
                </View>

                <View className="mt-2 flex-row items-end justify-between">
                  <View>
                    <Text className="font-anek-semibold text-h2 text-enamel">
                      {formatRupees(item.totalPaise)}
                    </Text>
                    <Text className="font-anek text-caption-xs text-ink-soft">{date}</Text>
                  </View>
                  <Text className="text-lg text-brass">›</Text>
                </View>
              </Pressable>
            );
          }}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            query.isFetchingNextPage ? (
              <View className="items-center py-4">
                <ActivityIndicator color="#C8912F" />
              </View>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={query.isRefetching}
              onRefresh={() => {
                query.refetch();
                countsQuery.refetch();
              }}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
