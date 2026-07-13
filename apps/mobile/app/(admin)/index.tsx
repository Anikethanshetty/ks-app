import { useMemo, useState, useEffect } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { InventoryTab, InventoryVariantDto } from "@kss/shared";
import { inventoryApi } from "@/lib/endpoints";
import { useSocket } from "@/lib/socket";
import { SignOutButton } from "@/components/SignOutButton";
import { useSession } from "@/lib/session";

// Logged-in guard — session is always available in authenticated routes.

const TABS: InventoryTab[] = ["all", "low_stock", "out_of_stock"];
const PAGE_SIZE = 50;

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function InventoryRow({ variant }: { variant: InventoryVariantDto }) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const name =
    lang === "kn"
      ? variant.productNameKn
      : lang === "hi"
        ? variant.productNameHi
        : variant.productNameEn;

  return (
    <View className="flex-row items-center justify-between border-b border-ruled px-gutter py-4">
      <View className="flex-1 gap-1 pr-3">
        <Text className="font-anek-medium text-body-lg text-ink" numberOfLines={1}>
          {name}
        </Text>
        <Text className="font-anek text-caption text-ink-soft" numberOfLines={1}>
          {variant.productNameEn} · {variant.packLabel}
        </Text>
      </View>
      <View className="items-end gap-1">
        <Text className="font-mono text-price text-brass">
          {formatRupees(variant.sellingPricePaise)}
        </Text>
        {variant.isOutOfStock ? (
          <Text className="font-anek-medium text-caption text-chilli">
            {t("admin.inventory.outOfStock")}
          </Text>
        ) : variant.isLowStock ? (
          <Text className="font-anek-medium text-caption text-turmeric">
            {t("admin.inventory.stockLabel", { count: variant.stock })}
          </Text>
        ) : (
          <Text className="font-anek text-caption text-ink-soft">
            {t("admin.inventory.stockLabel", { count: variant.stock })}
          </Text>
        )}
      </View>
    </View>
  );
}

/** A05 Inventory list — with navigation to product add/edit (A06). */
export default function AdminInventoryScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<InventoryTab>("all");

  const query = useInfiniteQuery({
    queryKey: ["admin", "inventory", tab],
    queryFn: ({ pageParam }) => inventoryApi.list(tab, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.items.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    // Socket.IO subscription (T2.6) invalidates query on inventory:updated events.
    refetchInterval: false,
  });

  const queryClient = useQueryClient();
  const { user } = useSession();
  const { subscribe } = useSocket(!!user && user.role === "admin");

  // Socket.IO subscription to replace 15s polling (T2.6)
  useEffect(() => {
    const unsub = subscribe("order:new", () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "inventory"] });
    });
    return () => unsub();
  }, [subscribe]);

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const counts = query.data?.pages[0]?.counts;

  function tabLabel(tb: InventoryTab): string {
    if (tb === "all") return t("admin.inventory.tabAll");
    if (tb === "low_stock")
      return `${t("admin.inventory.tabLowStock")}${counts ? ` (${counts.lowStock})` : ""}`;
    return `${t("admin.inventory.tabOutOfStock")}${counts ? ` (${counts.outOfStock})` : ""}`;
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center justify-between px-gutter pt-2">
  <Text className="font-anek-semibold text-h1 text-enamel">
          {t("admin.inventory.title")}
        </Text>
        <View className="flex-row items-center gap-2">
          <Link href="/admin/payments" asChild>
            <Pressable className="rounded-chip bg-turmeric-tint px-3 py-1.5 active:opacity-70">
              <Text className="font-anek-medium text-caption-xs text-enamel">{t("admin.payments.title")}</Text>
            </Pressable>
          </Link>
          <Link href="/admin/orders" asChild>
            <Pressable className="rounded-chip bg-surface border border-ruled px-3 py-1.5 active:opacity-70">
              <Text className="font-anek-medium text-caption text-enamel">{t("admin.orders.title")}</Text>
            </Pressable>
          </Link>
          <Link href="/admin/inventory/product/new" asChild>
            <Pressable className="rounded-chip bg-brass-tint px-3 py-1.5">
              <Text className="font-anek-medium text-caption text-enamel">{t("admin.inventory.addProduct")}</Text>
            </Pressable>
          </Link>
          <Link href="/admin/settings" asChild>
            <Pressable className="rounded-chip bg-surface border border-ruled px-3 py-1.5 active:opacity-70">
              <Text className="font-anek-medium text-caption-xs text-ink-soft">⚙️</Text>
            </Pressable>
          </Link>
          <SignOutButton />
        </View>
      </View>

      <View className="flex-row gap-2 px-gutter py-3">
        {TABS.map((tb) => {
          const active = tab === tb;
          return (
            <Pressable
              key={tb}
              onPress={() => setTab(tb)}
              className={`rounded-chip px-4 py-2 ${active ? "bg-enamel" : "border border-ruled bg-paper"}`}
            >
              <Text
                className={`font-anek-medium text-caption ${active ? "text-paper" : "text-ink-soft"}`}
              >
                {tabLabel(tb)}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-anek text-body text-ink-soft">{t("admin.inventory.loading")}</Text>
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="text-center font-anek text-body text-ink-soft">
            {t("admin.inventory.error")}
          </Text>
          <Pressable onPress={() => query.refetch()}>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <Text className="text-center font-anek text-body text-ink-soft">
            {t("admin.inventory.empty")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(v) => v.id}
          renderItem={({ item }) => (
            <Link href={`/admin/inventory/product/${item.productId}`} asChild>
              <Pressable>
                <InventoryRow variant={item} />
              </Pressable>
            </Link>
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage) query.fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl refreshing={query.isRefetching} onRefresh={() => query.refetch()} />
          }
        />
      )}
    </SafeAreaView>
  );
}
