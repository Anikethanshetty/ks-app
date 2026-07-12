import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CatalogueCategoryDto, CatalogueProductDto } from "@kss/shared";
import { catalogueApi } from "@/lib/endpoints";

const PAGE_SIZE = 50;

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function ProductRow({ product }: { product: CatalogueProductDto }) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const name =
    lang === "kn"
      ? product.nameKn
      : lang === "hi"
        ? product.nameHi
        : product.nameEn;

  const variant = product.defaultVariant;
  const canAdd = variant && variant.stock > 0 && product.isAvailable;

  return (
    <Link href={`/customer/product/${product.id}`} asChild>
      <Pressable className="flex-row items-center justify-between border-b border-ruled px-gutter py-4 active:opacity-70">
        <View className="flex-1 gap-1 pr-3">
          <Text className="font-anek-medium text-body-lg text-ink" numberOfLines={1}>
            {name}
          </Text>
          {product.brand ? (
            <Text className="font-anek text-caption text-ink-soft" numberOfLines={1}>
              {product.brand}
            </Text>
          ) : null}
          {variant ? (
            <Text className="font-anek text-caption text-ink-soft">
              {variant.packLabel}
            </Text>
          ) : null}
        </View>
        <View className="items-end gap-1">
          {variant ? (
            <>
              <Text className="font-mono text-price text-brass">
                {formatRupees(variant.sellingPricePaise)}
              </Text>
              <Text className="font-anek text-caption text-ink-soft line-through">
                {formatRupees(variant.mrpPaise)}
              </Text>
            </>
          ) : null}
          {!canAdd ? (
            <Text className="font-anek-medium text-caption text-chilli">
              {t("customer.products.outOfStock")}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Link>
  );
}

export default function CustomerProductsScreen() {
  const { categoryId } = useLocalSearchParams<{ categoryId: string }>();
  const { t } = useTranslation();

  const query = useInfiniteQuery({
    queryKey: ["customer", "products", categoryId],
    queryFn: ({ pageParam }) => catalogueApi.listProducts(categoryId!, pageParam, PAGE_SIZE),
    initialPageParam: 1,
    getNextPageParam: (lastPage) =>
      lastPage.items.length === PAGE_SIZE ? lastPage.page + 1 : undefined,
    enabled: !!categoryId,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <View className="flex-row items-center px-gutter pt-2">
        <Link href="../" asChild>
          <Pressable className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
            <Text className="font-anek-medium text-caption text-ink">← Back</Text>
          </Pressable>
        </Link>
      </View>

      <View className="px-gutter pb-3">
        <Text className="font-anek-semibold text-h2 text-enamel">
          {t("customer.products.title")}
        </Text>
      </View>

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-anek text-body text-ink-soft">{t("customer.products.loading")}</Text>
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="font-anek text-body text-ink-soft">{t("customer.products.error")}</Text>
          <Pressable onPress={() => query.refetch()}>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <Text className="text-center font-anek text-body text-ink-soft">
            {t("customer.products.noProducts")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => <ProductRow product={item} />}
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
