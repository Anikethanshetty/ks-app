import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { paymentApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

function PaymentRow({
  payment,
  onVerify,
  onReject,
  isProcessing,
}: {
  payment: any;
  onVerify: (id: string) => void;
  onReject: (id: string) => void;
  isProcessing: boolean;
}) {
  const { t } = useTranslation();

  const date = new Date(payment.submittedAt).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View className="mb-3 rounded-card border border-ruled bg-surface p-4">
      {/* Order + Amount header */}
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="font-mono text-caption text-ink-soft">
          {t("admin.payments.order", { number: payment.orderNumber ?? "—" })}
        </Text>
        <Text className="font-mono text-h2 text-enamel">
          {formatRupees(payment.amountPaise)}
        </Text>
      </View>

      {/* UTR + Date */}
      <View className="mb-3 gap-1">
        <Text className="font-mono text-caption text-ink" numberOfLines={1}>
          {t("admin.payments.utr", { utr: payment.upiReference ?? "—" })}
        </Text>
        <Text className="font-anek text-caption-xs text-ink-soft">{date}</Text>
      </View>

      {/* Verify / Reject buttons */}
      <View className="flex-row gap-3">
        <Pressable
          onPress={() => onVerify(payment.id)}
          disabled={isProcessing}
          className="flex-1 items-center rounded-chip bg-forest py-2 disabled:opacity-50"
        >
          <Text className="font-anek-semibold text-caption text-paper">
            {t("admin.payments.verify")}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onReject(payment.id)}
          disabled={isProcessing}
          className="flex-1 items-center rounded-chip border border-chilli py-2 disabled:opacity-50"
        >
          <Text className="font-anek-semibold text-caption text-chilli">
            {t("admin.payments.reject")}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function AdminPaymentsScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rejectModal, setRejectModal] = useState<{
    paymentId: string;
    reason: string;
  } | null>(null);

  // Fetch pending payments with cursor-based pagination
  const query = useInfiniteQuery({
    queryKey: ["admin", "payments"],
    queryFn: ({ pageParam }) => paymentApi.listPending(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });

  const payments = query.data?.pages.flatMap((p) => p.items) ?? [];

  // Verify payment
  const verifyMutation = useMutation({
    mutationFn: (paymentId: string) =>
      paymentApi.verify(paymentId, "verify"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "counts"] });
    },
    onError: () => {
      Alert.alert(t("common.somethingWrong"), t("admin.payments.actionError"));
    },
  });

  // Reject payment
  const rejectMutation = useMutation({
    mutationFn: ({
      paymentId,
      reason,
    }: {
      paymentId: string;
      reason?: string;
    }) => paymentApi.verify(paymentId, "reject", reason),
    onSuccess: () => {
      setRejectModal(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "payments"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "orders", "counts"] });
    },
    onError: () => {
      Alert.alert(t("common.somethingWrong"), t("admin.payments.actionError"));
    },
  });

  const handleVerify = useCallback(
    (paymentId: string) => {
      verifyMutation.mutate(paymentId);
    },
    [verifyMutation],
  );

  const handleReject = useCallback(
    (paymentId: string) => {
      Alert.alert(
        t("admin.payments.confirmReject"),
        "",
        [
          { text: t("common.cancel"), style: "cancel" },
          {
            text: t("admin.payments.reject"),
            style: "destructive",
            onPress: () => rejectMutation.mutate({ paymentId }),
          },
        ],
      );
    },
    [rejectMutation, t],
  );

  const isProcessing = verifyMutation.isPending || rejectMutation.isPending;

  return (
    <SafeAreaView className="flex-1 bg-paper">
      {/* Header */}
      <View className="flex-row items-center justify-between px-gutter pt-2 pb-4">
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70"
          >
            <Text className="font-anek-medium text-caption text-ink">←</Text>
          </Pressable>
          <Text className="font-anek-semibold text-h2 text-enamel">
            {t("admin.payments.title")}
          </Text>
        </View>
      </View>

      {query.isPending ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#C8912F" />
        </View>
      ) : query.isError ? (
        <View className="flex-1 items-center justify-center gap-3 px-gutter">
          <Text className="font-anek text-body text-ink-soft">
            {t("admin.payments.error")}
          </Text>
          <Pressable onPress={() => query.refetch()}>
            <Text className="font-anek-medium text-body text-enamel">
              {t("common.retry")}
            </Text>
          </Pressable>
        </View>
      ) : payments.length === 0 ? (
        <View className="flex-1 items-center justify-center px-gutter">
          <Text className="font-anek text-body text-ink-soft">
            {t("admin.payments.empty")}
          </Text>
        </View>
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(p: any) => p.id}
          contentContainerClassName="px-gutter pb-8"
          renderItem={({ item }) => (
            <PaymentRow
              payment={item}
              onVerify={handleVerify}
              onReject={handleReject}
              isProcessing={isProcessing}
            />
          )}
          onEndReached={() => {
            if (query.hasNextPage && !query.isFetchingNextPage)
              query.fetchNextPage();
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
              onRefresh={() => query.refetch()}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
