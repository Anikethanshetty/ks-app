import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Language, PublicUser } from "@kss/shared";
import i18n from "@/i18n";
import { authApi } from "./endpoints";
import { getStoredLanguage, setStoredLanguage } from "./language";

/**
 * The app-wide session (TRD §0 T0.5). On launch it restores the language and,
 * from the refresh token in secure storage, the signed-in user — so a force-quit
 * survives. The route guard in the root layout reads `ready`, `languageChosen`
 * and `user` to decide the destination.
 */
type Session = {
  /** Bootstrap finished — the guard must wait for this before redirecting. */
  ready: boolean;
  /** The first-launch language picker has been answered. */
  languageChosen: boolean;
  user: PublicUser | null;
  chooseLanguage: (lang: Language) => Promise<void>;
  /** Called after a successful OTP verify (tokens are already stored). */
  signIn: (user: PublicUser) => void;
  /** Reflect a profile change (e.g. after onboarding). */
  setUser: (user: PublicUser) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [languageChosen, setLanguageChosen] = useState(false);
  const [user, setUserState] = useState<PublicUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredLanguage();
      if (stored) await i18n.changeLanguage(stored);

      let restored: PublicUser | null = null;
      try {
        // apiFetch refreshes once on the 401 that the missing in-memory access
        // token triggers, using the refresh token in secure storage.
        restored = await authApi.me();
      } catch {
        restored = null;
      }
      if (cancelled) return;

      if (restored) {
        await i18n.changeLanguage(restored.language);
        setUserState(restored);
        setLanguageChosen(true);
      } else if (stored) {
        setLanguageChosen(true);
      }
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseLanguage = useCallback(async (lang: Language) => {
    await setStoredLanguage(lang);
    await i18n.changeLanguage(lang);
    setLanguageChosen(true);
  }, []);

  const signIn = useCallback((next: PublicUser) => {
    setUserState(next);
  }, []);

  const setUser = useCallback(async (next: PublicUser) => {
    await i18n.changeLanguage(next.language);
    setUserState(next);
  }, []);

  const signOut = useCallback(async () => {
    await authApi.logout();
    setUserState(null);
  }, []);

  const value = useMemo<Session>(
    () => ({ ready, languageChosen, user, chooseLanguage, signIn, setUser, signOut }),
    [ready, languageChosen, user, chooseLanguage, signIn, setUser, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}
