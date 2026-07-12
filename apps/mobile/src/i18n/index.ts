import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import kn from "./locales/kn.json";
import hi from "./locales/hi.json";
import { deviceLanguage } from "@/lib/language";

/**
 * i18next, initialised synchronously at import with bundled resources so the
 * first render already has strings (no Suspense fallback). The stored/server
 * language is applied later via `i18n.changeLanguage` in the session bootstrap.
 */
if (!i18n.isInitialized) {
  i18n.use(initReactI18next).init({
    resources: {
      en: { translation: en },
      kn: { translation: kn },
      hi: { translation: hi },
    },
    lng: deviceLanguage(),
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
    react: { useSuspense: false },
  });
}

export default i18n;
