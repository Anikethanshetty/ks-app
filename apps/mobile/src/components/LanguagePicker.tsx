import { Pressable, Text, View } from "react-native";
import type { Language } from "@kss/shared";
import { LANGUAGE_NAMES, SUPPORTED_LANGUAGES } from "@/lib/language";

/** The script each language's own name is written in, so it renders correctly. */
const FONT: Record<Language, string> = {
  kn: "font-anek-medium",
  hi: "font-deva-semibold",
  en: "font-anek-medium",
};

/** A vertical list of the three languages; the selected one reads in enamel. */
export function LanguagePicker({
  value,
  onChange,
}: {
  value: Language | null;
  onChange: (lang: Language) => void;
}) {
  return (
    <View className="gap-3">
      {SUPPORTED_LANGUAGES.map((lang) => {
        const selected = value === lang;
        return (
          <Pressable
            key={lang}
            onPress={() => onChange(lang)}
            className={`h-16 flex-row items-center justify-between rounded-card border px-5 ${
              selected ? "border-enamel bg-brass-tint" : "border-ruled bg-paper"
            }`}
          >
            <Text className={`text-h2 ${FONT[lang]} ${selected ? "text-enamel" : "text-ink"}`}>
              {LANGUAGE_NAMES[lang]}
            </Text>
            {selected ? (
              <Text className="font-anek-semibold text-body-lg text-enamel">✓</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}
