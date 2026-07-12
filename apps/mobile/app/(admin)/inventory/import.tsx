import { useState } from "react";
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
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ImportRowResult } from "@kss/shared";
import { inventoryApi } from "@/lib/endpoints";

/** A08 CSV Import screen — paste CSV, preview row-level results, then commit. */
export default function CsvImportScreen() {
  const { t } = useTranslation();
  const [csv, setCsv] = useState("");

  const previewMutation = useMutation({
    mutationFn: () => inventoryApi.importPreview(csv),
    onError: () => Alert.alert(t("admin.csvImport.parseError")),
  });

  const commitMutation = useMutation({
    mutationFn: () => inventoryApi.importCommit(csv),
    onSuccess: (data) => {
      let msg = t("admin.csvImport.commitSuccess", {
        products: data.productsCreated,
        variants: data.variantsCreated,
        aliases: data.aliasesCreated,
      });
      if (data.errors.length > 0) {
        msg += " " + t("admin.csvImport.commitErrors", { count: data.errors.length });
      }
      Alert.alert(msg);
      setCsv("");
      previewMutation.reset();
    },
    onError: () => Alert.alert(t("admin.csvImport.error")),
  });

  const rows = previewMutation.data?.rows ?? [];
  const totalRows = previewMutation.data?.totalRows ?? 0;
  const validRows = previewMutation.data?.validRows ?? 0;
  const errorRows = previewMutation.data?.errorRows ?? 0;

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
              {t("admin.csvImport.title")}
            </Text>
            <Text className="mt-1 font-anek text-caption text-ink-soft leading-5">
              {t("admin.csvImport.subtitle")}
            </Text>
          </View>

          {/* CSV input */}
          <View className="gap-2">
            <Text className="font-anek-medium text-caption text-ink-soft">
              {t("admin.csvImport.csvLabel")}
            </Text>
            <TextInput
              value={csv}
              onChangeText={setCsv}
              placeholder={t("admin.csvImport.csvPlaceholder")}
              placeholderTextColor="#6A6E67"
              multiline
              className="min-h-[160px] rounded-button border border-ruled bg-paper px-4 py-3 font-mono text-caption text-ink"
            />
          </View>

          {/* Action buttons */}
          <View className="mt-4 flex-row gap-3">
            <Pressable
              onPress={() => previewMutation.mutate()}
              disabled={!csv.trim() || previewMutation.isPending}
              className={`flex-1 h-12 items-center justify-center rounded-button ${
                csv.trim() && !previewMutation.isPending ? "bg-enamel" : "bg-enamel/40"
              }`}
            >
              {previewMutation.isPending ? (
                <ActivityIndicator color="#FBFAF6" />
              ) : (
                <Text className="font-anek-semibold text-body text-paper">
                  {t("admin.csvImport.preview")}
                </Text>
              )}
            </Pressable>

            <Pressable
              onPress={() => commitMutation.mutate()}
              disabled={!csv.trim() || commitMutation.isPending}
              className={`flex-1 h-12 items-center justify-center rounded-button ${
                csv.trim() && !commitMutation.isPending ? "bg-fresh" : "bg-fresh/40"
              }`}
            >
              {commitMutation.isPending ? (
                <ActivityIndicator color="#FBFAF6" />
              ) : (
                <Text className="font-anek-semibold text-body text-paper">
                  {t("admin.csvImport.commit")}
                </Text>
              )}
            </Pressable>
          </View>

          {/* Summary */}
          {previewMutation.data && (
            <View className="mt-6 flex-row gap-4">
              <SummaryBadge
                label={t("admin.csvImport.totalRows", { count: totalRows })}
                color="text-ink"
              />
              <SummaryBadge
                label={t("admin.csvImport.validRows", { count: validRows })}
                color="text-fresh"
              />
              {errorRows > 0 && (
                <SummaryBadge
                  label={t("admin.csvImport.errorRows", { count: errorRows })}
                  color="text-chilli"
                />
              )}
            </View>
          )}

          {/* Preview table */}
          {rows.length > 0 && (
            <View className="mt-4 gap-2">
              {/* Header row */}
              <View className="flex-row border-b border-ruled pb-2">
                <Text className="w-10 font-anek-semibold text-caption text-ink-soft">
                  {t("admin.csvImport.rowNumber")}
                </Text>
                <Text className="flex-1 font-anek-semibold text-caption text-ink-soft">
                  {t("admin.csvImport.productName")}
                </Text>
                <Text className="w-8 font-anek-semibold text-caption text-ink-soft text-center">
                  #
                </Text>
              </View>

              {rows.map((row: ImportRowResult) => (
                <View
                  key={row.rowNumber}
                  className={`flex-row items-start border-b border-ruled py-3 ${
                    row.valid ? "" : "bg-chilli/5"
                  }`}
                >
                  <Text className="w-10 font-mono text-caption text-ink-soft">
                    {row.rowNumber}
                  </Text>
                  <View className="flex-1 gap-0.5">
                    <Text
                      className="font-anek text-body text-ink"
                      numberOfLines={1}
                    >
                      {row.nameEn}
                    </Text>
                    {row.errors.length > 0 && (
                      <Text className="font-anek text-caption text-chilli" numberOfLines={2}>
                        {row.errors.join("; ")}
                      </Text>
                    )}
                  </View>
                  <Text
                    className={`w-8 text-center font-anek-semibold text-body ${
                      row.valid ? "text-fresh" : "text-chilli"
                    }`}
                  >
                    {row.valid
                      ? t("admin.csvImport.valid")
                      : t("admin.csvImport.invalid")}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Empty state */}
          {!previewMutation.data && !previewMutation.isPending && !previewMutation.isError && (
            <View className="mt-12 items-center">
              <Text className="text-center font-anek text-body text-ink-soft">
                {t("admin.csvImport.empty")}
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SummaryBadge({ label, color }: { label: string; color: string }) {
  return (
    <View className="rounded-chip bg-paper px-3 py-1.5 shadow-sm border border-ruled">
      <Text className={`font-anek-medium text-caption ${color}`}>{label}</Text>
    </View>
  );
}
