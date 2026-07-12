import { useCallback } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CatalogueCategoryDto } from "@kss/shared";
import { catalogueApi } from "@/lib/endpoints";
import { SignOutButton } from "@/components/SignOutButton";

function CategoryCard({ category }: { category: CatalogueCategoryDto }) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const name =
    lang === "kn"
      ? category.nameKn
      : lang === "hi"
        ? category.nameHi
        : category.nameEn;

  return (
    <Link href={`/customer/products/${category.id}`} asChild>
      <Pressable className="flex-1 flex-row items-center justify-between rounded-card bg-surface px-gutter py-4 active:opacity-70">
        <View className="flex-1 gap-1">
          <Text className="font-anek-semibold text-body-lg text-ink" numberOfLines={1}>
            {name}
          </Text>
          <Text className="font-anek text-caption text-ink-soft">
            {t("customer.categories.products", { count: category.productCount })}
          </Text>
        </View>
        <Text className="text-2xl text-brass">›</Text>
      </Pressable>
    </Link>
  );
}

export default function CustomerHome() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  const categoriesQuery = useQuery({
    queryKey: ["customer", "categories"],
    queryFn: () => catalogueApi.listCategories(),
  });

  const categories = categoriesQuery.data?.items ?? [];

  const handleSearch = useCallback(() => {
    router.push("/customer/search");
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center justify-between px-gutter pt-2">
        <View className="flex-1">
          <Text className="font-anek-semibold text-h1 text-enamel" numberOfLines={1}>
            {t("customer.home.title")}
          </Text>
          <Text className="font-anek text-caption text-ink-soft">
            {t("customer.home.subtitle")}
          </Text>
        </View>
        <SignOutButton />
      </View>

      {/* Search bar */}
      <Pressable
        onPress={handleSearch}
        className="mx-gutter mt-4 flex-row items-center rounded-chip border border-ruled bg-surface px-4 py-3"
      >
        <Text className="mr-2 text-lg text-ink-soft">🔍</Text>
        <Text className="font-anek text-body text-ink-soft">
          {t("customer.home.search")}
        </Text>
      </Pressable>

      {/* Categories */}
      <View className="mt-6 px-gutter">
        <Text className="font-anek-semibold text-h2 text-ink">
          {t("customer.categories.title")}
        </Text>
      </View>

      {categoriesQuery.isPending ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-anek text-body text-ink-soft">
            {t("customer.categories.loading")}
          </Text>
        </View>
      ) : categoriesQuery.isError ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <Text className="font-anek text-body text-ink-soft">
            {t("customer.categories.error")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(c) => c.id}
          contentContainerClassName="gap-3 px-gutter pb-8 pt-3"
          renderItem={({ item }) => <CategoryCard category={item} />}
          refreshControl={
            <RefreshControl
              refreshing={categoriesQuery.isRefetching}
              onRefresh={() => categoriesQuery.refetch()}
            />
          }
          ListEmptyComponent={
            <View className="items-center justify-center pt-12">
              <Text className="font-anek text-body text-ink-soft">
                {t("customer.categories.noProducts")}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
