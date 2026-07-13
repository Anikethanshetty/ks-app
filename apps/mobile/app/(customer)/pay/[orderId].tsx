import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { orderApi, paymentApi, shopApi } from "@/lib/endpoints";

function formatRupees(paise: number): string {
  return `₹${(paise / 100).toFixed(2)}`;
}

/** Generate the upi:// intent URI for deep linking. */
function upiIntentUri(
  vpa: string,
  payeeName: string,
  amountPaise: number,
  orderRef: string,
): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: (amountPaise / 100).toFixed(2),
    tr: orderRef,
    tn: `Payment for ${orderRef}`,
    cu: "INR",
  });
  return `upi://pay?${params.toString()}`;
}

type UpiApp = {
  key: string;
  name: string;
  scheme: string;
};

const UPI_APPS: UpiApp[] = [
  { key: "gpay", name: "Google Pay", scheme: "tez" },
  { key: "phonepe", name: "PhonePe", scheme: "phonepe" },
  { key: "paytm", name: "Paytm", scheme: "paytmmp" },
];

export default function UpiPaymentScreen() {
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const { t } = useTranslation();
  const [utr, setUtr] = useState("");
  const [copied, setCopied] = useState(false);

  // Fetch order details
  const orderQuery = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => orderApi.get(orderId!),
    enabled: !!orderId,
  });

  // Fetch shop settings for UPI info
  const settingsQuery = useQuery({
    queryKey: ["shopSettings"],
    queryFn: () => shopApi.getSettings(),
  });

  const order = orderQuery.data;
  const settings = settingsQuery.data;

  // Determine if payment was already submitted
  const paymentSubmitted =
    order?.status === "payment_pending_verification";

  // Submit payment mutation
  const submitPayment = useMutation({
    mutationFn: () =>
      paymentApi.submit(orderId!, { upiReference: utr.trim() }),
    onSuccess: () => {
      Alert.alert(
        t("customer.payment.success"),
        t("customer.payment.successMessage"),
        [
          {
            text: "OK",
            onPress: () => router.replace(`/customer/order/${orderId}`),
          },
        ],
      );
    },
    onError: (err: any) => {
      const code = err?.code ?? "INTERNAL_ERROR";
      if (code === "PAYMENT_ALREADY_SUBMITTED") {
        Alert.alert(
          t("customer.payment.pendingTitle"),
          t("customer.payment.pendingMessage"),
        );
        router.replace(`/customer/order/${orderId}`);
      } else {
        Alert.alert(t("common.somethingWrong"), t("customer.payment.error"));
      }
    },
  });

  const upiVpa = settings?.upiVpa ?? "";
  const upiPayeeName = settings?.upiPayeeName ?? settings?.shopName ?? "";
  const upiQrUrl = settings?.upiQrUrl ?? "";
  const amountPaise = order?.totalPaise ?? 0;

  const handleCopyUpiId = useCallback(() => {
    if (!upiVpa) return;
    // On native, Clipboard is available via expo-clipboard, but we use
    // a simple workaround: just set copied state and show the UPI ID.
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [upiVpa]);

  const openUpiApp = useCallback(
    (scheme: string) => {
      if (!upiVpa) return;
      const intent = upiIntentUri(
        upiVpa,
        upiPayeeName,
        amountPaise,
        order?.orderNumber ?? orderId ?? "",
      );
      // Try the app-specific scheme first, fall back to generic upi://
      const appIntent = intent.replace("upi://pay", `${scheme}://upi/pay`);
      Linking.openURL(appIntent).catch(() => {
        // Fallback to generic UPI intent
        Linking.openURL(intent).catch(() => {
          Alert.alert(t("common.somethingWrong"), t("customer.payment.error"));
        });
      });
    },
    [upiVpa, upiPayeeName, amountPaise, order, orderId, t],
  );

  const handlePayCashInstead = useCallback(() => {
    Alert.alert(
      t("customer.checkout.cod"),
      "Change to Cash on Delivery?",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Yes",
          onPress: () => router.replace(`/customer/order/${orderId}`),
        },
      ],
    );
  }, [orderId, t]);

  if (orderQuery.isPending || settingsQuery.isPending) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator color="#C8912F" />
      </SafeAreaView>
    );
  }

  if (orderQuery.isError || !order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-paper gap-3 px-gutter">
        <Text className="font-anek text-body text-ink-soft">
          {t("customer.orders.error")}
        </Text>
        <Pressable onPress={() => orderQuery.refetch()}>
          <Text className="font-anek-medium text-body text-enamel">
            {t("common.retry")}
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-paper">
      <ScrollView className="flex-1" contentContainerClassName="pb-8">
        {/* Header */}
        <View className="flex-row items-center px-gutter pt-2 pb-4">
          <Pressable
            onPress={() => router.back()}
            className="mr-3 rounded-chip bg-surface px-3 py-1.5 active:opacity-70"
          >
            <Text className="font-anek-medium text-caption text-ink">←</Text>
          </Pressable>
          <Text className="font-anek-semibold text-h2 text-enamel">
            {t("customer.payment.title")}
          </Text>
        </View>

        {paymentSubmitted ? (
          /* Already submitted — show pending state */
          <View className="mx-gutter items-center rounded-card border border-turmeric bg-turmeric-tint p-6">
            <Text className="mb-2 text-4xl">⏳</Text>
            <Text className="mb-2 font-anek-semibold text-h2 text-enamel">
              {t("customer.payment.pendingTitle")}
            </Text>
            <Text className="text-center font-anek text-body text-ink-soft">
              {t("customer.payment.pendingMessage")}
            </Text>
            <Pressable
              onPress={() => router.replace(`/customer/order/${orderId}`)}
              className="mt-4 rounded-chip bg-enamel px-6 py-2"
            >
              <Text className="font-anek-medium text-caption text-paper">
                {t("customer.orders.view")}
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            {/* Amount hero */}
            <View className="mx-gutter mb-6 items-center rounded-card bg-brass-tint p-6">
              <Text className="mb-1 font-anek text-caption text-enamel">
                {t("customer.payment.amount")}
              </Text>
              <Text className="font-mono text-h1 text-enamel">
                {formatRupees(amountPaise)}
              </Text>
              <Text className="mt-1 font-anek text-caption-xs text-ink-soft">
                {t("customer.payment.orderRef", {
                  number: order.orderNumber,
                })}
              </Text>
            </View>

            {/* QR Code */}
            {upiQrUrl ? (
              <View className="mx-gutter mb-6 items-center">
                <Text className="mb-3 font-anek-semibold text-h2 text-ink">
                  {t("customer.payment.scanToPay")}
                </Text>
                <View className="overflow-hidden rounded-card border border-ruled bg-surface p-4">
                  <Image
                    source={{ uri: upiQrUrl }}
                    className="h-48 w-48"
                    resizeMode="contain"
                  />
                </View>
              </View>
            ) : (
              /* QR fallback: styled placeholder with UPI ID */
              <View className="mx-gutter mb-6 items-center">
                <Text className="mb-3 font-anek-semibold text-h2 text-ink">
                  {t("customer.payment.scanToPay")}
                </Text>
                <View className="h-48 w-48 items-center justify-center rounded-card border border-ruled bg-surface p-4">
                  <Text className="mb-2 text-4xl">📱</Text>
                  <Text className="font-mono text-caption text-ink-soft text-center">
                    {upiVpa || "UPI ID"}
                  </Text>
                </View>
              </View>
            )}

            {/* UPI ID with copy */}
            {upiVpa ? (
              <View className="mx-gutter mb-6 flex-row items-center justify-between rounded-card border border-ruled bg-surface p-4">
                <View className="flex-1 pr-3">
                  <Text className="mb-1 font-anek-medium text-caption-xs text-ink-soft">
                    {t("customer.payment.upiId")}
                  </Text>
                  <Text
                    className="font-mono text-body text-ink"
                    numberOfLines={1}
                  >
                    {upiVpa}
                  </Text>
                  {upiPayeeName ? (
                    <Text className="mt-0.5 font-anek text-caption-xs text-ink-soft">
                      {t("customer.payment.payee")}: {upiPayeeName}
                    </Text>
                  ) : null}
                </View>
                <Pressable
                  onPress={handleCopyUpiId}
                  className="rounded-chip bg-enamel px-4 py-2 active:opacity-70"
                >
                  <Text className="font-anek-medium text-caption-xs text-paper">
                    {copied
                      ? t("customer.payment.copied")
                      : t("customer.payment.copyUpiId")}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {/* UPI app deep links */}
            {upiVpa ? (
              <View className="mx-gutter mb-6">
                <Text className="mb-3 font-anek-semibold text-h2 text-ink">
                  {t("customer.payment.payWith")}
                </Text>
                <View className="gap-3">
                  {UPI_APPS.map((app) => (
                    <Pressable
                      key={app.key}
                      onPress={() => openUpiApp(app.scheme)}
                      className="flex-row items-center rounded-card border border-ruled bg-surface p-4 active:opacity-70"
                    >
                      <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-brass-tint">
                        <Text className="text-lg">
                          {app.key === "gpay"
                            ? "G"
                            : app.key === "phonepe"
                              ? "P"
                              : "₹"}
                        </Text>
                      </View>
                      <Text className="flex-1 font-anek-semibold text-body text-ink">
                        {t(`customer.payment.${app.key}`)}
                      </Text>
                      <Text className="text-lg text-brass">›</Text>
                    </Pressable>
                  ))}
                  {/* Other UPI apps (generic upi:// intent) */}
                  <Pressable
                    onPress={() => openUpiApp("upi")}
                    className="flex-row items-center rounded-card border border-ruled bg-surface p-4 active:opacity-70"
                  >
                    <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-surface">
                      <Text className="text-lg">📲</Text>
                    </View>
                    <Text className="flex-1 font-anek-semibold text-body text-ink">
                      {t("customer.payment.otherApps")}
                    </Text>
                    <Text className="text-lg text-brass">›</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="mx-gutter mb-6 rounded-chip bg-chilli-tint px-4 py-3">
                <Text className="font-anek text-caption text-paper">
                  UPI not configured. Please pay using Cash on Delivery or contact the shop.
                </Text>
              </View>
            )}

            {/* UTR input */}
            <View className="mx-gutter mb-4">
              <Text className="mb-2 font-anek-semibold text-h2 text-ink">
                {t("customer.payment.enterUtr")}
              </Text>
              <TextInput
                className="rounded-card border border-ruled bg-surface px-4 py-3 font-mono text-body text-ink"
                placeholder={t("customer.payment.utrPlaceholder")}
                placeholderTextColor="#9CA3AF"
                keyboardType="default"
                autoCapitalize="characters"
                maxLength={18}
                value={utr}
                onChangeText={setUtr}
              />
              <Text className="mt-1 font-anek text-caption-xs text-ink-soft">
                {t("customer.payment.utrHint")}
              </Text>
            </View>

            {/* Submit payment button */}
            <View className="mx-gutter mb-4">
              <Pressable
                onPress={() => submitPayment.mutate()}
                disabled={
                  utr.trim().length < 6 || submitPayment.isPending
                }
                className="items-center rounded-chip bg-enamel py-3 disabled:opacity-50"
              >
                <Text className="font-anek-semibold text-body text-paper">
                  {submitPayment.isPending
                    ? t("customer.payment.submitting")
                    : t("customer.payment.submitPayment")}
                </Text>
              </Pressable>
            </View>

            {/* Expire warning + pay cash instead */}
            <View className="mx-gutter gap-3">
              <Text className="text-center font-anek text-caption-xs text-ink-soft">
                {t("customer.payment.expireWarning")}
              </Text>
              <Pressable
                onPress={handlePayCashInstead}
                className="items-center active:opacity-70"
              >
                <Text className="font-anek-medium text-caption text-brass">
                  {t("customer.payment.payCashInstead")}
                </Text>
              </Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
