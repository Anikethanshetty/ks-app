import { useCallback, useEffect, useRef, useState } from "react";
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { SearchResultDto } from "@kss/shared";
import { catalogueApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function SearchResultRow({ result }: { result: SearchResultDto }) {
  const { i18n, t } = useTranslation();
  const lang = i18n.language;
  const p = result.product;
  const name =
    lang === "kn"
      ? p.nameKn
      : lang === "hi"
        ? p.nameHi
        : p.nameEn;

  const variant = p.defaultVariant;

  return (
    <Link href={`/customer/product/${p.id}`} asChild>
      <Pressable className="flex-row items-center justify-between border-b border-ruled px-gutter py-4 active:opacity-70">
        <View className="flex-1 gap-1 pr-3">
          <Text className="font-anek-medium text-body-lg text-ink" numberOfLines={1}>
            {name}
          </Text>
          {result.matchedAlias && (
            <Text className="font-anek text-caption text-brass">
              {t("customer.search.matchedAlias", { alias: result.matchedAlias })}
            </Text>
          )}
          {variant && (
            <Text className="font-anek text-caption text-ink-soft">
              {variant.packLabel}
            </Text>
          )}
        </View>
        {variant && (
          <Text className="font-mono text-price text-brass">
            {formatRupees(variant.sellingPricePaise)}
          </Text>
        )}
      </Pressable>
    </Link>
  );
}

export default function SearchScreen() {
  const { t, i18n } = useTranslation();
  const inputRef = useRef<TextInput>(null);
  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Clear the debounce timer on unmount so it doesn't set state on a dead component.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const handleChangeText = useCallback((text: string) => {
    setQueryText(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(text.trim());
    }, 300);
  }, []);

  const lang =
    i18n.language === "kn"
      ? "kn"
      : i18n.language === "hi"
        ? "hi"
        : "en";

  const searchQuery = useQuery({
    queryKey: ["customer", "search", debouncedQuery, lang],
    queryFn: () => catalogueApi.search(debouncedQuery, lang, 30),
    enabled: debouncedQuery.length > 0,
  });

  const results = searchQuery.data?.items ?? [];

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Search input */}
      <View className="flex-row items-center px-gutter pt-2">
        <Link href="../" asChild>
          <Pressable className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
            <Text className="font-anek-medium text-caption text-ink">← Back</Text>
          </Pressable>
        </Link>
        <View className="flex-1 rounded-chip border border-ruled bg-surface px-4 py-2">
          <TextInput
            ref={inputRef}
            value={queryText}
            onChangeText={handleChangeText}
            placeholder={t("customer.search.placeholder")}
            placeholderTextColor="#9CA3AF"
            className="font-anek text-body text-ink"
            autoFocus
            returnKeyType="search"
          />
        </View>
      </View>

      {/* Hint */}
      {!debouncedQuery && (
        <View className="items-center justify-center px-gutter pt-12">
          <Text className="text-center font-anek text-body text-ink-soft">
            {t("customer.search.hint")}
          </Text>
        </View>
      )}

      {/* Loading */}
      {searchQuery.isFetching && debouncedQuery.length > 0 && (
        <View className="items-center justify-center pt-8">
          <Text className="font-anek text-body text-ink-soft">
            {t("customer.search.loading")}
          </Text>
        </View>
      )}

      {/* Error */}
      {searchQuery.isError && (
        <View className="items-center justify-center pt-8 px-gutter">
          <Text className="font-anek text-body text-chilli">
            {t("customer.search.error")}
          </Text>
        </View>
      )}

      {/* Results header */}
      {debouncedQuery && !searchQuery.isFetching && !searchQuery.isError && (
        <View className="px-gutter py-3">
          <Text className="font-anek text-caption text-ink-soft">
            {searchQuery.data
              ? t("customer.search.resultsFor", { query: debouncedQuery })
              : null}
          </Text>
        </View>
      )}

      {/* Results */}
      {debouncedQuery && !searchQuery.isFetching && !searchQuery.isError && (
        <FlatList
          data={results}
          keyExtractor={(r) => r.product.id}
          renderItem={({ item }) => <SearchResultRow result={item} />}
          ListEmptyComponent={
            <View className="items-center justify-center pt-12 px-gutter">
              <Text className="text-center font-anek text-body text-ink-soft">
                {t("customer.search.noResults", { query: debouncedQuery })}
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}
