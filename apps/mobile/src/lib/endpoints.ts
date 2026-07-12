import {
  AuthTokens,
  HealthResponse,
  MePatchBody,
  OkResponse,
  OtpRequestResponse,
  PublicUser,
} from "@kss/shared";
import { apiFetch } from "./api";
import { API_ORIGIN } from "./config";
import { tokenStore } from "./tokens";

/** Liveness probe. Lives at the server root, not under /api/v1. */
export async function checkHealth(): Promise<HealthResponse> {
  const res = await fetch(`${API_ORIGIN}/health`);
  return HealthResponse.parse(await res.json());
}

export const authApi = {
  requestOtp: (phone: string) =>
    apiFetch("/auth/otp/request", {
      method: "POST",
      auth: false,
      body: { phone },
      schema: OtpRequestResponse,
    }),

  async verifyOtp(phone: string, code: string): Promise<AuthTokens> {
    const tokens = await apiFetch("/auth/otp/verify", {
      method: "POST",
      auth: false,
      body: { phone, code },
      schema: AuthTokens,
    });
    tokenStore.setAccess(tokens.accessToken);
    await tokenStore.setRefresh(tokens.refreshToken);
    return tokens;
  },

  me: () => apiFetch("/me", { schema: PublicUser }),

  updateMe: (body: MePatchBody) =>
    apiFetch("/me", { method: "PATCH", body, schema: PublicUser }),

  /** Revoke the stored refresh token server-side, then clear it locally. */
  async logout(): Promise<void> {
    const refreshToken = await tokenStore.getRefresh();
    if (refreshToken) {
      await apiFetch("/auth/logout", {
        method: "POST",
        auth: false,
        body: { refreshToken },
        schema: OkResponse,
      }).catch(() => {
        // A failed logout must not trap the user; we clear locally regardless.
      });
    }
    await tokenStore.clear();
  },
};
