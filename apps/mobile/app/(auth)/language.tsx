import { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { Language } from "@kss/shared";
import { LanguagePicker } from "@/components/LanguagePicker";
import { PrimaryButton, Screen } from "@/components/ui";
import i18n from "@/i18n";
import { useSession } from "@/lib/session";

/** First-launch language picker (T0.5). The guard routes here until answered. */
export default function LanguageChoice() {
  const { t } = useTranslation();
  const { chooseLanguage } = useSession();
  const [lang, setLang] = useState<Language>(i18n.language as Language);

  // Preview the choice live so the copy below is already in the picked language.
  function pick(next: Language) {
    setLang(next);
    void i18n.changeLanguage(next);
  }

  return (
    <Screen>
      <View className="gap-8">
        <View className="gap-2">
          <Text className="font-anek-semibold text-h1 text-enamel">{t("language.title")}</Text>
          <Text className="font-anek text-body text-ink-soft">{t("language.subtitle")}</Text>
        </View>

        <LanguagePicker value={lang} onChange={pick} />

        <PrimaryButton label={t("language.continue")} onPress={() => chooseLanguage(lang)} />
      </View>
    </Screen>
  );
}
