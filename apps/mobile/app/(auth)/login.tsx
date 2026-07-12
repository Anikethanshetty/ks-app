import { useState } from "react";
import { Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Field, PrimaryButton, Screen } from "@/components/ui";
import { authApi } from "@/lib/endpoints";

/** 10-digit Indian mobile number, no leading zero. */
const MOBILE = /^[6-9]\d{9}$/;

export default function Login() {
  const { t } = useTranslation();
  const [digits, setDigits] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!MOBILE.test(digits)) {
      setError(t("login.invalidPhone"));
      return;
    }
    setError(undefined);
    setBusy(true);
    const phone = `+91${digits}`;
    try {
      const { devHint } = await authApi.requestOtp(phone);
      router.push({ pathname: "/(auth)/otp", params: { phone, devHint: devHint ?? "" } });
    } catch {
      setError(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="font-anek-semibold text-h1 text-enamel">{t("login.title")}</Text>
          <Text className="font-anek text-body text-ink-soft">{t("login.subtitle")}</Text>
        </View>

        <View className="flex-row items-end gap-3">
          <View className="pb-3.5">
            <Text className="font-mono text-body-lg text-ink-soft">+91</Text>
          </View>
          <View className="flex-1">
            <Field
              label={t("login.phoneLabel")}
              placeholder={t("login.phonePlaceholder")}
              keyboardType="number-pad"
              textContentType="telephoneNumber"
              autoFocus
              maxLength={10}
              value={digits}
              onChangeText={(v) => setDigits(v.replace(/\D/g, ""))}
              error={error}
              className="font-mono"
            />
          </View>
        </View>

        <PrimaryButton
          label={busy ? t("login.sending") : t("login.sendOtp")}
          onPress={send}
          loading={busy}
          disabled={digits.length !== 10}
        />
      </View>
    </Screen>
  );
}
