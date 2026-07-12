import { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { AddressDto } from "@kss/shared";
import { addressApi } from "@/lib/endpoints";

function AddressCard({
  address,
  onEdit,
  onDelete,
}: {
  address: AddressDto;
  onEdit: (a: AddressDto) => void;
  onDelete: (a: AddressDto) => void;
}) {
  const { t } = useTranslation();
  const lines = [address.line1, address.line2, address.area, address.city, address.pincode]
    .filter(Boolean)
    .join(", ");

  return (
    <View className="rounded-card border border-ruled bg-surface p-4">
      <View className="mb-2 flex-row items-center gap-2">
        {address.label && (
          <Text className="rounded-chip bg-brass-tint px-2 py-0.5 font-anek-medium text-caption-xs text-enamel">
            {address.label}
          </Text>
        )}
        {address.isDefault && (
          <Text className="font-anek text-caption-xs text-forest">Default</Text>
        )}
      </View>
      <Text className="font-anek text-body text-ink" numberOfLines={3}>
        {lines}
      </Text>
      <View className="mt-3 flex-row gap-3">
        <Pressable onPress={() => onEdit(address)} className="active:opacity-70">
          <Text className="font-anek-medium text-caption text-brass">{t("common.edit")}</Text>
        </Pressable>
        <Pressable onPress={() => onDelete(address)} className="active:opacity-70">
          <Text className="font-anek-medium text-caption text-chilli">{t("customer.address.delete")}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AddressForm({
  initial,
  onDone,
}: {
  initial?: AddressDto | null;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(initial?.label ?? "");
  const [line1, setLine1] = useState(initial?.line1 ?? "");
  const [line2, setLine2] = useState(initial?.line2 ?? "");
  const [area, setArea] = useState(initial?.area ?? "");
  const [city, setCity] = useState(initial?.city ?? "Mysuru");
  const [pincode, setPincode] = useState(initial?.pincode ?? "");

  const mutation = useMutation({
    mutationFn: () =>
      initial
        ? addressApi.update(initial.id, { label, line1, line2: line2 || undefined, area, city, pincode })
        : addressApi.create({ label, line1, line2: line2 || undefined, area, city, pincode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["addresses"] });
      onDone();
    },
    onError: () => {
      Alert.alert(t("common.somethingWrong"), t("customer.address.saveError"));
    },
  });

  const canSave = line1.trim().length > 0 && area.trim().length > 0 && pincode.trim().length === 6;

  return (
    <ScrollView className="flex-1 bg-paper px-gutter" keyboardShouldPersistTaps="handled">
      <Text className="mb-4 font-anek-semibold text-h2 text-enamel">
        {initial ? t("customer.address.editTitle") : t("customer.address.addTitle")}
      </Text>

      <View className="gap-4">
        <View>
          <Text className="mb-1 font-anek-medium text-caption text-ink-soft">{t("customer.address.label")}</Text>
          <TextInput
            value={label}
            onChangeText={setLabel}
            placeholder={t("customer.address.labelPlaceholder")}
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
          />
        </View>

        <View>
          <Text className="mb-1 font-anek-medium text-caption text-ink-soft">{t("customer.address.line1")} *</Text>
          <TextInput
            value={line1}
            onChangeText={setLine1}
            placeholder={t("customer.address.line1Placeholder")}
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
          />
        </View>

        <View>
          <Text className="mb-1 font-anek-medium text-caption text-ink-soft">{t("customer.address.line2")}</Text>
          <TextInput
            value={line2}
            onChangeText={setLine2}
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
          />
        </View>

        <View>
          <Text className="mb-1 font-anek-medium text-caption text-ink-soft">{t("customer.address.area")} *</Text>
          <TextInput
            value={area}
            onChangeText={setArea}
            className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
          />
        </View>

        <View className="flex-row gap-3">
          <View className="flex-[2]">
            <Text className="mb-1 font-anek-medium text-caption text-ink-soft">{t("customer.address.city")}</Text>
            <TextInput
              value={city}
              onChangeText={setCity}
              className="rounded-card border border-ruled bg-surface px-4 py-3 font-anek text-body text-ink"
            />
          </View>
          <View className="flex-1">
            <Text className="mb-1 font-anek-medium text-caption text-ink-soft">{t("customer.address.pincode")} *</Text>
            <TextInput
              value={pincode}
              onChangeText={setPincode}
              keyboardType="number-pad"
              maxLength={6}
              className="rounded-card border border-ruled bg-surface px-4 py-3 font-mono text-body text-ink"
            />
          </View>
        </View>
      </View>

      <View className="mt-6 pb-8">
        <Pressable
          onPress={() => mutation.mutate()}
          disabled={!canSave || mutation.isPending}
          className="items-center rounded-chip bg-enamel py-3 disabled:opacity-50"
        >
          <Text className="font-anek-semibold text-body text-paper">
            {mutation.isPending ? t("customer.address.saving") : t("customer.address.save")}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

export default function AddressListScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<AddressDto | null | "new">(null);

  const query = useQuery({
    queryKey: ["addresses"],
    queryFn: () => addressApi.list(),
  });

  const addresses = query.data?.items ?? [];

  const deleteMutation = useMutation({
    mutationFn: (id: string) => addressApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["addresses"] }),
  });

  const handleDelete = useCallback(
    (address: AddressDto) => {
      Alert.alert(t("customer.address.deleteConfirm"), "", [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: t("customer.address.delete"),
          style: "destructive",
          onPress: () => deleteMutation.mutate(address.id),
        },
      ]);
    },
    [t, deleteMutation],
  );

  if (editing) {
    return (
      <SafeAreaView className="flex-1 bg-paper">
        <View className="flex-row items-center px-gutter pt-2 pb-3">
          <Pressable onPress={() => setEditing(null)} className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
            <Text className="font-anek-medium text-caption text-ink">← Back</Text>
          </Pressable>
        </View>
        <AddressForm
          initial={editing === "new" ? null : editing}
          onDone={() => setEditing(null)}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center justify-between px-gutter pt-2 pb-3">
        <View className="flex-row items-center">
          <Link href="../" asChild>
            <Pressable className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70">
              <Text className="font-anek-medium text-caption text-ink">←</Text>
            </Pressable>
          </Link>
          <Text className="font-anek-semibold text-h2 text-enamel">{t("customer.address.title")}</Text>
        </View>
        <Pressable
          onPress={() => setEditing("new")}
          className="rounded-chip bg-brass-tint px-3 py-1.5 active:opacity-70"
        >
          <Text className="font-anek-medium text-caption text-enamel">{t("customer.address.addNew")}</Text>
        </Pressable>
      </View>

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <Text className="font-anek text-body text-ink-soft">{t("common.loading")}</Text>
        </View>
      ) : addresses.length === 0 ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="font-anek text-body text-ink-soft">{t("customer.address.empty")}</Text>
          <Pressable
            onPress={() => setEditing("new")}
            className="rounded-chip bg-enamel px-6 py-3"
          >
            <Text className="font-anek-semibold text-body text-paper">{t("customer.address.addNew")}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={addresses}
          keyExtractor={(a) => a.id}
          contentContainerClassName="gap-3 px-gutter pb-8"
          renderItem={({ item }) => (
            <AddressCard address={item} onEdit={(a) => setEditing(a)} onDelete={handleDelete} />
          )}
        />
      )}
    </SafeAreaView>
  );
}
