import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useLocalSearchParams } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CatalogueVariantDto } from "@kss/shared";
import { catalogueApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function VariantCard({
  variant,
  selected,
  onSelect,
}: {
  variant: CatalogueVariantDto;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const discount = variant.mrpPaise - variant.sellingPricePaise;
  const outOfStock = variant.stock <= 0;

  return (
    <Pressable
      onPress={outOfStock ? undefined : onSelect}
      className={`rounded-card border p-4 ${
        selected
          ? "border-brass bg-brass-tint"
          : outOfStock
            ? "border-ruled bg-paper opacity-50"
            : "border-ruled bg-surface"
      }`}
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-1">
          <Text className="font-anek-semibold text-body text-ink">
            {variant.packLabel}
          </Text>
          <View className="flex-row items-center gap-2">
            <Text className="font-mono text-price text-brass">
              {formatRupees(variant.sellingPricePaise)}
            </Text>
            {discount > 0 && (
              <Text className="font-anek text-caption text-ink-soft line-through">
                {formatRupees(variant.mrpPaise)}
              </Text>
            )}
          </View>
          {discount > 0 && (
            <Text className="font-anek text-caption text-forest">
              {t("customer.products.youSave", {
                save: formatRupees(discount).replace("₹", ""),
              })}
            </Text>
          )}
          {outOfStock && (
            <Text className="font-anek-medium text-caption text-chilli">
              {t("customer.products.outOfStock")}
            </Text>
          )}
        </View>
        {selected && (
          <Text className="text-xl text-brass">✓</Text>
        )}
      </View>
    </Pressable>
  );
}

export default function CustomerProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ["customer", "product", id],
    queryFn: () => catalogueApi.getProduct(id!),
    enabled: !!id,
  });

  const product = query.data;

  if (query.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <Text className="font-anek text-body text-ink-soft">{t("admin.product.loading")}</Text>
      </SafeAreaView>
    );
  }

  if (query.isError || !product) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper gap-3 px-gutter">
        <Text className="font-anek text-body text-ink-soft">{t("common.somethingWrong")}</Text>
        <Link href="../" asChild>
          <Pressable>
            <Text className="font-anek-medium text-body text-enamel">{t("common.retry")}</Text>
          </Pressable>
        </Link>
      </SafeAreaView>
    );
  }

  const name =
    lang === "kn"
      ? product.nameKn
      : lang === "hi"
        ? product.nameHi
        : product.nameEn;

  const categoryName =
    lang === "kn"
      ? product.categoryNameKn
      : lang === "hi"
        ? product.categoryNameHi
        : product.categoryNameEn;

  const selectedVariant = useMemo(
    () =>
      selectedVariantId
        ? product.variants.find((v) => v.id === selectedVariantId) ?? null
        : product.variants[0] ?? null,
    [selectedVariantId, product.variants],
  );

  // Auto-select first variant on load
  useEffect(() => {
    if (!selectedVariantId && product.variants.length > 0) {
      setSelectedVariantId(product.variants[0]!.id);
    }
  }, [selectedVariantId, product.variants]);

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-gutter pt-2 pb-4">
          <Link href="../" asChild>
            <Pressable className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
              <Text className="font-anek-medium text-caption text-ink">← Back</Text>
            </Pressable>
          </Link>
        </View>

        {/* Product info */}
        <View className="px-gutter pb-6">
          <Text className="font-anek-semibold text-h1 text-enamel">{name}</Text>
          <Text className="font-anek text-body text-ink-soft">{categoryName}</Text>
          {product.brand && (
            <Text className="font-anek text-caption text-ink-soft">{product.brand}</Text>
          )}
        </View>

        {/* Selected variant price */}
        {selectedVariant && (
          <View className="mx-gutter mb-6 rounded-card bg-surface p-4">
            <Text className="font-anek text-body text-ink-soft">
              {selectedVariant.packLabel}
            </Text>
            <View className="mt-2 flex-row items-baseline gap-2">
              <Text className="font-mono text-h1 text-brass">
                {formatRupees(selectedVariant.sellingPricePaise)}
              </Text>
              {selectedVariant.mrpPaise > selectedVariant.sellingPricePaise && (
                <Text className="font-anek text-body text-ink-soft line-through">
                  {formatRupees(selectedVariant.mrpPaise)}
                </Text>
              )}
            </View>
            {selectedVariant.mrpPaise > selectedVariant.sellingPricePaise && (
              <Text className="font-anek-medium text-caption text-forest">
                {t("customer.products.youSave", {
                  save: formatRupees(selectedVariant.mrpPaise - selectedVariant.sellingPricePaise).replace("₹", ""),
                })}
              </Text>
            )}
          </View>
        )}

        {/* Variant selector */}
        {product.variants.length > 1 && (
          <View className="px-gutter pb-6">
            <Text className="mb-3 font-anek-semibold text-h2 text-ink">
              {t("customer.products.variants")}
            </Text>
            <View className="gap-3">
              {product.variants.map((v) => (
                <VariantCard
                  key={v.id}
                  variant={v}
                  selected={selectedVariant?.id === v.id}
                  onSelect={() => setSelectedVariantId(v.id)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Description */}
        {(() => {
          const desc =
            lang === "kn"
              ? product.descriptionKn
              : lang === "hi"
                ? product.descriptionHi
                : product.descriptionEn;
          return desc ? (
            <View className="px-gutter pb-8">
              <Text className="font-anek text-body text-ink">{desc}</Text>
            </View>
          ) : null;
        })()}
      </ScrollView>

      {/* Bottom action bar */}
      <View className="border-t border-ruled bg-surface px-gutter py-4">
        <Pressable
          className="items-center rounded-chip bg-enamel py-3 active:opacity-80 disabled:opacity-50"
          disabled={!selectedVariant || selectedVariant.stock <= 0 || !product.isAvailable}
        >
          <Text className="font-anek-semibold text-body text-paper">
            {selectedVariant && selectedVariant.stock <= 0
              ? t("customer.products.outOfStock")
              : t("customer.products.addToCart")}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
