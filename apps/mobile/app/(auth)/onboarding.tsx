import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Language } from "@kss/shared";
import { LanguagePicker } from "@/components/LanguagePicker";
import { Field, PrimaryButton, Screen } from "@/components/ui";
import i18n from "@/i18n";
import { authApi } from "@/lib/endpoints";
import { useSession } from "@/lib/session";

/**
 * Shown once after a new user's first verify (guard sends anyone without a
 * `fullName` here). Captures the name + language, then PATCH /me.
 */
export default function Onboarding() {
  const { t } = useTranslation();
  const { setUser } = useSession();
  const [name, setName] = useState("");
  const [lang, setLang] = useState<Language>(i18n.language as Language);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function finish() {
    const fullName = name.trim();
    if (!fullName) {
      setError(t("onboarding.nameRequired"));
      return;
    }
    setError(undefined);
    setBusy(true);
    try {
      const user = await authApi.updateMe({ fullName, language: lang });
      await setUser(user); // guard now routes to the role home
    } catch {
      setError(t("common.somethingWrong"));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View className="gap-6">
        <View className="gap-2">
          <Text className="font-anek-semibold text-h1 text-enamel">{t("onboarding.title")}</Text>
          <Text className="font-anek text-body text-ink-soft">{t("onboarding.subtitle")}</Text>
        </View>

        <Field
          label={t("onboarding.nameLabel")}
          placeholder={t("onboarding.namePlaceholder")}
          autoFocus
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
          error={error}
        />

        <View className="gap-2">
          <Text className="font-anek-medium text-caption text-ink-soft">
            {t("onboarding.langLabel")}
          </Text>
          <LanguagePicker
            value={lang}
            onChange={(next) => {
              setLang(next);
              void i18n.changeLanguage(next);
            }}
          />
        </View>

        <PrimaryButton
          label={busy ? t("onboarding.saving") : t("onboarding.finish")}
          onPress={finish}
          loading={busy}
        />
      </View>
    </Screen>
  );
}
