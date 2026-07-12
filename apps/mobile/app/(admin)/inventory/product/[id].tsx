import { useEffect, useMemo, useReducer, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AliasDto, CategoryDto, CreateVariantBody, UpdateProductBody, UpdateVariantBody } from "@kss/shared";
import { UnitType } from "@kss/shared";
import { productApi } from "@/lib/endpoints";

type Unit = "kg" | "g" | "l" | "ml" | "piece" | "packet" | "dozen" | "bundle";

// ── form state ──

type VariantForm = {
  key: string; // local key for list rendering; stable across renders
  sku: string;
  packSize: string;
  unit: string;
  packLabel: string;
  mrpPaise: string;
  costPricePaise: string;
  sellingPricePaise: string;
  stock: string;
  lowStockThreshold: string;
  isActive: boolean;
  /**
   * If editing an existing variant, its DB id. For new variants this is
   * undefined.
   */
  id?: string;
};

type FormState = {
  nameEn: string;
  nameKn: string;
  nameHi: string;
  categoryId: string;
  brand: string;
  imageUrl: string;
  isAvailable: boolean;
  variants: VariantForm[];
};

type Action =
  | { type: "SET_FIELD"; field: keyof FormState; value: string | boolean }
  | { type: "SET_VARIANT"; index: number; field: keyof VariantForm; value: string | boolean }
  | { type: "ADD_VARIANT" }
  | { type: "REMOVE_VARIANT"; index: number }
  | { type: "LOAD"; state: FormState };

function emptyVariant(key: string): VariantForm {
  return {
    key,
    sku: "",
    packSize: "1",
    unit: "kg",
    packLabel: "",
    mrpPaise: "",
    costPricePaise: "",
    sellingPricePaise: "",
    stock: "0",
    lowStockThreshold: "5",
    isActive: true,
  };
}

const UNITS = UnitType.options;

function formReducer(state: FormState, action: Action): FormState {
  switch (action.type) {
    case "SET_FIELD":
      return { ...state, [action.field]: action.value };
    case "SET_VARIANT": {
      const current = state.variants[action.index];
      if (!current) return state;
      const variants = [...state.variants];
      variants[action.index] = { ...current, [action.field]: action.value } as VariantForm;
      return { ...state, variants };
    }
    case "ADD_VARIANT":
      return {
        ...state,
        variants: [...state.variants, emptyVariant(String(Date.now() + Math.random()))],
      };
    case "REMOVE_VARIANT":
      if (state.variants.length <= 1) return state; // keep at least one
      return { ...state, variants: state.variants.filter((_, i) => i !== action.index) };
    case "LOAD":
      return action.state;
  }
}

function emptyForm(): FormState {
  return {
    nameEn: "",
    nameKn: "",
    nameHi: "",
    categoryId: "",
    brand: "",
    imageUrl: "",
    isAvailable: true,
    variants: [emptyVariant("new")],
  };
}

/** Convert a product DTO from the API back to form state for editing. */
function dtoToForm(dto: Record<string, unknown>): FormState {
  const variants = (dto.variants as Array<Record<string, unknown>> | undefined) ?? [];
  return {
    nameEn: (dto.nameEn as string) ?? "",
    nameKn: (dto.nameKn as string) ?? "",
    nameHi: (dto.nameHi as string) ?? "",
    categoryId: (dto.categoryId as string) ?? "",
    brand: (dto.brand as string) ?? "",
    imageUrl: (dto.imageUrl as string) ?? "",
    isAvailable: (dto.isAvailable as boolean) ?? true,
    variants: variants.map((v, i) => ({
      key: (v.id as string) ?? `edit-${i}`,
      id: v.id as string | undefined,
      sku: (v.sku as string) ?? "",
      packSize: String((v.packSize as number) ?? 1),
      unit: (v.unit as string) ?? "kg",
      packLabel: (v.packLabel as string) ?? "",
      mrpPaise: v.mrpPaise != null ? String(Math.round((v.mrpPaise as number) / 100)) : "",
      costPricePaise: v.costPricePaise != null ? String(Math.round((v.costPricePaise as number) / 100)) : "",
      sellingPricePaise: v.sellingPricePaise != null ? String(Math.round((v.sellingPricePaise as number) / 100)) : "",
      stock: String((v.stock as number) ?? 0),
      lowStockThreshold: String((v.lowStockThreshold as number) ?? 5),
      isActive: (v.isActive as boolean) ?? true,
    })),
  };
}

// ── helpers ──

function parseRupees(input: string): number | null {
  const n = Number(input.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100); // convert to paise
}

// ── screen ──

export default function ProductEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === "new";
  const { t, i18n } = useTranslation();
  const lang = i18n.language as "kn" | "hi" | "en";

  const [form, dispatch] = useReducer(formReducer, null, emptyForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch categories
  const categoriesQuery = useQuery({
    queryKey: ["admin", "categories"],
    queryFn: () => productApi.listCategories(),
  });

  // Fetch product for editing
  const productQuery = useQuery({
    queryKey: ["admin", "product", id],
    queryFn: () => productApi.get(id!),
    enabled: !isNew,
  });

  // Load product data into form
  useEffect(() => {
    if (!isNew && productQuery.data) {
      dispatch({ type: "LOAD", state: dtoToForm(productQuery.data) });
    }
  }, [isNew, productQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      setSaving(true);

      // Validate
      const newErrors: Record<string, string> = {};
      if (!form.nameEn.trim()) newErrors.nameEn = t("common.required");
      if (!form.nameKn.trim()) newErrors.nameKn = t("common.required");
      if (!form.nameHi.trim()) newErrors.nameHi = t("common.required");
      if (!form.categoryId) newErrors.categoryId = t("admin.product.selectCategory");

      // Validate variants
      for (let i = 0; i < form.variants.length; i++) {
        const v = form.variants[i]!;
        if (!v.sku.trim()) newErrors[`variant-${i}-sku`] = t("common.required");
        if (!v.packLabel.trim()) newErrors[`variant-${i}-packLabel`] = t("common.required");
        if (!v.sellingPricePaise.trim()) newErrors[`variant-${i}-sellingPrice`] = t("common.required");
      }
      if (form.variants.length === 0) {
        newErrors.variants = t("admin.product.noVariants");
      }

      setErrors(newErrors);
      if (Object.keys(newErrors).length > 0) throw new Error("validation");

      const firstVariant = form.variants[0]!;
      const unit = firstVariant.unit as "kg" | "g" | "l" | "ml" | "piece" | "packet" | "dozen" | "bundle";
      const variantBody = {
        sku: firstVariant.sku,
        packSize: Number(firstVariant.packSize) || 1,
        unit,
        packLabel: firstVariant.packLabel,
        mrpPaise: parseRupees(firstVariant.mrpPaise) ?? 0,
        costPricePaise: firstVariant.costPricePaise
          ? (parseRupees(firstVariant.costPricePaise) ?? undefined)
          : undefined,
        sellingPricePaise: parseRupees(firstVariant.sellingPricePaise) ?? 0,
        stock: Number(firstVariant.stock) || 0,
        lowStockThreshold: Number(firstVariant.lowStockThreshold) || 5,
      };

      if (isNew) {
        await productApi.create({
          categoryId: form.categoryId,
          nameEn: form.nameEn,
          nameKn: form.nameKn,
          nameHi: form.nameHi,
          brand: form.brand || undefined,
          imageUrl: form.imageUrl || undefined,
          variants: [variantBody],
        });
      } else {
        await productApi.update(id!, {
          categoryId: form.categoryId,
          nameEn: form.nameEn,
          nameKn: form.nameKn,
          nameHi: form.nameHi,
          brand: form.brand || undefined,
          imageUrl: form.imageUrl || undefined,
          isAvailable: form.isAvailable,
        });

        // Handle variant updates/creates
        for (let i = 0; i < form.variants.length; i++) {
          const v = form.variants[i]!;
          const vu = v.unit as "kg" | "g" | "l" | "ml" | "piece" | "packet" | "dozen" | "bundle";
          const variantPayload: any = {
            sku: v.sku,
            packSize: Number(v.packSize) || 1,
            unit: vu,
            packLabel: v.packLabel,
            mrpPaise: parseRupees(v.mrpPaise) ?? 0,
            costPricePaise: v.costPricePaise
              ? (parseRupees(v.costPricePaise) ?? undefined)
              : undefined,
            sellingPricePaise: parseRupees(v.sellingPricePaise) ?? 0,
            stock: Number(v.stock) || 0,
            lowStockThreshold: Number(v.lowStockThreshold) || 5,
            isActive: v.isActive,
          };

          if (v.id) {
            await productApi.updateVariant(id!, v.id, variantPayload);
          } else {
            await productApi.addVariant(id!, variantPayload);
          }
        }
      }
    },
    onSuccess: () => {
      setSaving(false);
      Alert.alert(t("admin.product.saveSuccess"));
    },
    onError: (err: any) => {
      setSaving(false);
      if (err?.message !== "validation") {
        Alert.alert(t("admin.product.saveError"));
      }
    },
  });

  const queryClient = useQueryClient();
  const [aliasInput, setAliasInput] = useState("");

  // Fetch aliases for edit mode
  const aliasesQuery = useQuery({
    queryKey: ["admin", "product", id, "aliases"],
    queryFn: () => productApi.listAliases(id!),
    enabled: !isNew,
  });

  const addAliasMutation = useMutation({
    mutationFn: (alias: string) => productApi.createAlias(id!, { alias }),
    onSuccess: () => {
      setAliasInput("");
      queryClient.invalidateQueries({ queryKey: ["admin", "product", id, "aliases"] });
    },
    onError: () => Alert.alert(t("admin.product.saveError")),
  });

  const deleteAliasMutation = useMutation({
    mutationFn: (aliasId: string) => productApi.deleteAlias(id!, aliasId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "product", id, "aliases"] });
    },
    onError: () => Alert.alert(t("admin.product.saveError")),
  });

  const handleAddAlias = () => {
    const trimmed = aliasInput.trim();
    if (!trimmed) return;
    addAliasMutation.mutate(trimmed);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const categoryOptions = useMemo(() => categoriesQuery.data?.items ?? [], [categoriesQuery.data]);
  const aliases = aliasesQuery.data?.items ?? [];

  const isLoading = (!isNew && productQuery.isPending) || categoriesQuery.isPending;

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" color="#0F3A32" />
        <Text className="mt-3 font-anek text-body text-ink-soft">
          {t("admin.product.loading")}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView className="flex-1" contentContainerClassName="px-gutter pb-32">
          {/* Header */}
          <View className="py-4">
            <Text className="font-anek-semibold text-h1 text-enamel">
              {isNew ? t("admin.product.addTitle") : t("admin.product.editTitle")}
            </Text>
          </View>

          {/* ── Product details ── */}
          <View className="gap-4">
            <Text className="font-anek-semibold text-h2 text-ink">
              {t("admin.product.nameEn")}
            </Text>
            <FormField
              value={form.nameEn}
              onChangeText={(v) => dispatch({ type: "SET_FIELD", field: "nameEn", value: v })}
              error={errors.nameEn}
            />

            <Text className="font-anek-semibold text-h2 text-ink">
              {t("admin.product.nameKn")}
            </Text>
            <FormField
              value={form.nameKn}
              onChangeText={(v) => dispatch({ type: "SET_FIELD", field: "nameKn", value: v })}
              error={errors.nameKn}
            />

            <Text className="font-anek-semibold text-h2 text-ink">
              {t("admin.product.nameHi")}
            </Text>
            <FormField
              value={form.nameHi}
              onChangeText={(v) => dispatch({ type: "SET_FIELD", field: "nameHi", value: v })}
              error={errors.nameHi}
            />

            {/* Category picker */}
            <View className="gap-2">
              <Text className="font-anek-semibold text-h2 text-ink">
                {t("admin.product.category")}
              </Text>
              {errors.categoryId && (
                <Text className="font-anek text-caption text-chilli">{errors.categoryId}</Text>
              )}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="py-1">
                <View className="flex-row flex-wrap gap-2">
                  {categoryOptions.map((cat) => {
                    const active = cat.id === form.categoryId;
                    const catName =
                      cat[`name${lang.charAt(0).toUpperCase() + lang.slice(1)}` as keyof CategoryDto] ??
                      cat.nameEn;
                    return (
                      <Pressable
                        key={cat.id}
                        onPress={() =>
                          dispatch({ type: "SET_FIELD", field: "categoryId", value: cat.id })
                        }
                        className={`rounded-chip px-4 py-2 ${
                          active ? "bg-enamel" : "border border-ruled"
                        }`}
                      >
                        <Text
                          className={`font-anek-medium text-caption ${
                            active ? "text-paper" : "text-ink-soft"
                          }`}
                        >
                          {catName}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <FormField
              label={t("admin.product.brand")}
              value={form.brand}
              onChangeText={(v) => dispatch({ type: "SET_FIELD", field: "brand", value: v })}
            />

            <FormField
              label={t("admin.product.imageUrl")}
              value={form.imageUrl}
              onChangeText={(v) => dispatch({ type: "SET_FIELD", field: "imageUrl", value: v })}
              placeholder="https://..."
            />

            {/* Availability toggle */}
            {!isNew && (
              <View className="flex-row items-center gap-3 py-2">
                <Pressable
                  onPress={() =>
                    dispatch({
                      type: "SET_FIELD",
                      field: "isAvailable",
                      value: !form.isAvailable,
                    })
                  }
                  className={`h-6 w-11 rounded-full ${form.isAvailable ? "bg-fresh" : "bg-ruled"}`}
                >
                  <View
                    className={`mt-0.5 h-5 w-5 rounded-full bg-paper shadow-sm ${
                      form.isAvailable ? "ml-[22px]" : "ml-0.5"
                    }`}
                  />
                </Pressable>
                <Text className="font-anek text-body text-ink">
                  {t("admin.product.isAvailable")}
                </Text>
              </View>
            )}
          </View>

          {/* ── ⭐ Aliases (T1.3) — what makes voice work ── */}
          {!isNew && (
            <View className="mt-8 gap-4 rounded-card border-2 border-brass-tint bg-paper p-4 shadow-sm">
              <View className="gap-1">
                <Text className="font-anek-semibold text-h2 text-enamel">
                  ⭐ {t("admin.product.aliases")}
                </Text>
                <Text className="font-anek text-caption text-ink-soft leading-5">
                  {t("admin.product.aliasesHint")}
                </Text>
              </View>

              {aliasesQuery.isPending ? (
                <Text className="font-anek text-body text-ink-soft">
                  {t("admin.product.loadingAliases")}
                </Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {aliases.map((alias: AliasDto) => (
                    <View
                      key={alias.id}
                      className="flex-row items-center gap-1 rounded-full bg-brass-tint px-3 py-1.5"
                    >
                      <Text className="font-anek-medium text-caption text-enamel">
                        {alias.alias}
                      </Text>
                      <Pressable
                        onPress={() => deleteAliasMutation.mutate(alias.id)}
                        accessibilityLabel={t("admin.product.deleteAlias")}
                        className="ml-1 h-5 w-5 items-center justify-center rounded-full bg-enamel/20"
                      >
                        <Text className="text-caption text-enamel">✕</Text>
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              {/* Add alias input */}
              <View className="flex-row items-center gap-2">
                <TextInput
                  value={aliasInput}
                  onChangeText={setAliasInput}
                  placeholder={t("admin.product.aliasPlaceholder")}
                  placeholderTextColor="#6A6E67"
                  returnKeyType="done"
                  onSubmitEditing={handleAddAlias}
                  className="flex-1 rounded-button border border-ruled bg-paper px-4 py-2.5 font-anek text-body text-ink"
                />
                <Pressable
                  onPress={handleAddAlias}
                  disabled={!aliasInput.trim() || addAliasMutation.isPending}
                  className={`rounded-button px-4 py-2.5 ${
                    aliasInput.trim() && !addAliasMutation.isPending
                      ? "bg-enamel"
                      : "bg-enamel/40"
                  }`}
                >
                  <Text className="font-anek-medium text-body text-paper">
                    {t("admin.product.addAlias")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* ── Variants ── */}
          <View className="mt-8 gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="font-anek-semibold text-h2 text-ink">
                {t("admin.product.variants")}
              </Text>
              <Pressable
                onPress={() => dispatch({ type: "ADD_VARIANT" })}
                className="rounded-chip bg-brass-tint px-3 py-1.5"
              >
                <Text className="font-anek-medium text-caption text-enamel">
                  + {t("admin.product.addVariant")}
                </Text>
              </Pressable>
            </View>

            {errors.variants && (
              <Text className="font-anek text-caption text-chilli">{errors.variants}</Text>
            )}

            {form.variants.map((variant, idx) => (
              <VariantCard
                key={variant.key}
                variant={variant}
                index={idx}
                errors={errors}
                t={t}
                dispatch={dispatch}
                isOnly={form.variants.length <= 1}
              />
            ))}
          </View>
        </ScrollView>

        {/* ── Save button (docked) ── */}
        <View className="border-t border-ruled bg-paper px-gutter py-4">
          <Pressable
            onPress={handleSave}
            disabled={saving}
            className={`h-14 items-center justify-center rounded-button ${
              saving ? "bg-enamel/60" : "bg-enamel"
            }`}
          >
            {saving ? (
              <ActivityIndicator color="#FBFAF6" />
            ) : (
              <Text className="font-anek-semibold text-body-lg text-paper">
                {t("admin.product.save")}
              </Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── sub-components ──

function FormField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  multiline,
  keyboardType,
}: {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "url";
}) {
  return (
    <View className="gap-1.5">
      {label && (
        <Text className="font-anek-medium text-caption text-ink-soft">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#6A6E67"
        multiline={multiline}
        keyboardType={keyboardType}
        className={`rounded-button border bg-paper px-4 py-3 font-anek text-body-lg text-ink ${
          error ? "border-chilli" : "border-ruled"
        } ${multiline ? "min-h-[80px]" : ""}`}
      />
      {error && <Text className="font-anek text-caption text-chilli">{error}</Text>}
    </View>
  );
}

function VariantCard({
  variant,
  index,
  errors,
  t,
  dispatch,
  isOnly,
}: {
  variant: VariantForm;
  index: number;
  errors: Record<string, string>;
  t: (key: string, opts?: any) => string;
  dispatch: React.Dispatch<Action>;
  isOnly: boolean;
}) {
  return (
    <View className="rounded-card border border-ruled bg-paper p-4 shadow-sm">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-anek-semibold text-body text-enamel">
          {t("admin.product.variants")} #{index + 1}
        </Text>
        {!isOnly && (
          <Pressable
            onPress={() => dispatch({ type: "REMOVE_VARIANT", index })}
            className="rounded-chip bg-chilli/10 px-3 py-1"
          >
            <Text className="font-anek-medium text-caption text-chilli">
              {t("admin.product.deleteVariant")}
            </Text>
          </Pressable>
        )}
      </View>

      <View className="gap-3">
        {/* SKU + Unit row */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormField
              label={t("admin.product.sku")}
              value={variant.sku}
              onChangeText={(v) => dispatch({ type: "SET_VARIANT", index, field: "sku", value: v })}
              error={errors[`variant-${index}-sku`]}
            />
          </View>
          <View className="w-24">
            <Text className="mb-1.5 font-anek-medium text-caption text-ink-soft">
              {t("admin.product.unit")}
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View className="flex-row flex-wrap gap-1">
                {UNITS.map((u) => {
                  const active = variant.unit === u;
                  return (
                    <Pressable
                      key={u}
                      onPress={() =>
                        dispatch({ type: "SET_VARIANT", index, field: "unit", value: u as string })
                      }
                      className={`rounded px-2 py-1 ${
                        active ? "bg-enamel" : "border border-ruled"
                      }`}
                    >
                      <Text
                        className={`font-mono text-caption ${
                          active ? "text-paper" : "text-ink-soft"
                        }`}
                      >
                        {u}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </View>

        {/* Pack size + Pack label */}
        <View className="flex-row gap-3">
          <View className="w-28">
            <FormField
              label={t("admin.product.packSize")}
              value={variant.packSize}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "packSize", value: v })
              }
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <FormField
              label={t("admin.product.packLabel")}
              value={variant.packLabel}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "packLabel", value: v })
              }
              error={errors[`variant-${index}-packLabel`]}
            />
          </View>
        </View>

        {/* Prices row */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormField
              label={t("admin.product.mrpPaise")}
              value={variant.mrpPaise}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "mrpPaise", value: v })
              }
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <FormField
              label={t("admin.product.costPricePaise")}
              value={variant.costPricePaise}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "costPricePaise", value: v })
              }
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <FormField
              label={t("admin.product.sellingPricePaise")}
              value={variant.sellingPricePaise}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "sellingPricePaise", value: v })
              }
              error={errors[`variant-${index}-sellingPrice`]}
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Stock + Low stock threshold row */}
        <View className="flex-row gap-3">
          <View className="flex-1">
            <FormField
              label={t("admin.product.stock")}
              value={variant.stock}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "stock", value: v })
              }
              keyboardType="numeric"
            />
          </View>
          <View className="flex-1">
            <FormField
              label={t("admin.product.lowStockThreshold")}
              value={variant.lowStockThreshold}
              onChangeText={(v) =>
                dispatch({ type: "SET_VARIANT", index, field: "lowStockThreshold", value: v })
              }
              keyboardType="numeric"
            />
          </View>
        </View>

        {/* Active toggle */}
        {variant.id && (
          <View className="flex-row items-center gap-3 py-1">
            <Pressable
              onPress={() =>
                dispatch({
                  type: "SET_VARIANT",
                  index,
                  field: "isActive",
                  value: !variant.isActive,
                })
              }
              className={`h-6 w-11 rounded-full ${variant.isActive ? "bg-fresh" : "bg-ruled"}`}
            >
              <View
                className={`mt-0.5 h-5 w-5 rounded-full bg-paper shadow-sm ${
                  variant.isActive ? "ml-[22px]" : "ml-0.5"
                }`}
              />
            </Pressable>
            <Text className="font-anek text-body text-ink">
              {t("admin.product.isActive")}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}
