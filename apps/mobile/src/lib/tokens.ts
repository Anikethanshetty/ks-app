import * as SecureStore from "expo-secure-store";

/**
 * Token storage (TRD §0 T0.5): the refresh token lives in expo-secure-store
 * (encrypted keystore), the short-lived access token stays in memory only —
 * never AsyncStorage, never localStorage.
 */
const REFRESH_KEY = "kss.refreshToken";

let accessToken: string | null = null;

export const tokenStore = {
  getAccess(): string | null {
    return accessToken;
  },
  setAccess(token: string | null): void {
    accessToken = token;
  },
  getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY);
  },
  async setRefresh(token: string | null): Promise<void> {
    if (token) await SecureStore.setItemAsync(REFRESH_KEY, token);
    else await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
  async clear(): Promise<void> {
    accessToken = null;
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  },
};
