import { useState } from "react";
import { Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ApiError } from "@/lib/api";
import { Field, LinkButton, PrimaryButton, Screen } from "@/components/ui";
import { authApi } from "@/lib/endpoints";
import { useSession } from "@/lib/session";

export default function Otp() {
  const { t } = useTranslation();
  const { signIn } = useSession();
  const { phone, devHint } = useLocalSearchParams<{ phone: string; devHint?: string }>();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function verify() {
    setError(undefined);
    setBusy(true);
    try {
      const { user } = await authApi.verifyOtp(phone, code);
      // The root route guard sends the user onward (onboarding or role home).
      signIn(user);
    } catch (err) {
      setError(err instanceof ApiError ? t("otp.wrongCode") : t("common.somethingWrong"));
      setBusy(false);
    }
  }

  async function resend() {
    setError(undefined);
    setCode("");
    try {
      await authApi.requestOtp(phone);
    } catch {
      setError(t("common.somethingWrong"));
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="font-anek-semibold text-h1 text-enamel">{t("otp.title")}</Text>
          <Text className="font-anek text-body text-ink-soft">{t("otp.sentTo", { phone })}</Text>
          {devHint ? (
            <Text className="font-mono text-caption text-turmeric">{devHint}</Text>
          ) : null}
        </View>

        <Field
          label={t("otp.codeLabel")}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoFocus
          maxLength={6}
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, ""))}
          error={error}
          className="font-mono tracking-[8px]"
        />

        <PrimaryButton
          label={busy ? t("otp.verifying") : t("otp.verify")}
          onPress={verify}
          loading={busy}
          disabled={code.length !== 6}
        />

        <View className="gap-4">
          <LinkButton label={t("otp.resend")} onPress={resend} disabled={busy} />
          <LinkButton
            label={t("otp.changeNumber")}
            onPress={() => router.back()}
            disabled={busy}
          />
        </View>
      </View>
    </Screen>
  );
}
