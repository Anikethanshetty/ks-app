import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import type { Language } from "@kss/shared";

/**
 * The UI language (TRD §0 T0.5). Persisted locally so the picker only shows on
 * the very first launch; after login the server's `user.language` takes over.
 */
const KEY = "kss.language";

export const SUPPORTED_LANGUAGES: Language[] = ["kn", "hi", "en"];

/** Human-readable, each in its own script (for the picker). */
export const LANGUAGE_NAMES: Record<Language, string> = {
  kn: "ಕನ್ನಡ",
  hi: "हिन्दी",
  en: "English",
};

function isSupported(v: string | null | undefined): v is Language {
  return v != null && (SUPPORTED_LANGUAGES as string[]).includes(v);
}

/** Best guess from the device locale; falls back to Kannada (the shop's script). */
export function deviceLanguage(): Language {
  for (const locale of getLocales()) {
    if (isSupported(locale.languageCode)) return locale.languageCode;
  }
  return "kn";
}

export async function getStoredLanguage(): Promise<Language | null> {
  const value = await AsyncStorage.getItem(KEY);
  return isSupported(value) ? value : null;
}

export async function setStoredLanguage(lang: Language): Promise<void> {
  await AsyncStorage.setItem(KEY, lang);
}
