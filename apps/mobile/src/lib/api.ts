import type { z } from "zod";
import { ErrorResponse, TokenPair } from "@kss/shared";
import { API_URL } from "./config";
import { tokenStore } from "./tokens";

/**
 * The single typed API client (TRD §2.2). Every response is parsed with a Zod
 * schema from packages/shared, the access token is attached automatically, a
 * 401 refreshes the token exactly once and retries, and callers only ever see
 * `error.code` — never `error.message` (which is for humans, not for switching).
 */
export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  schema: z.ZodType<T>;
  /** Attach the bearer token (default true). Auth endpoints pass false. */
  auth?: boolean;
  idempotencyKey?: string;
  /** Internal: prevents an infinite refresh loop. */
  _retried?: boolean;
};

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = await tokenStore.getRefresh();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) {
    await tokenStore.clear();
    return false;
  }
  const parsed = TokenPair.safeParse(await res.json().catch(() => null));
  if (!parsed.success) {
    await tokenStore.clear();
    return false;
  }
  tokenStore.setAccess(parsed.data.accessToken);
  await tokenStore.setRefresh(parsed.data.refreshToken);
  return true;
}

export async function apiFetch<T>(path: string, opts: RequestOptions<T>): Promise<T> {
  const { method = "GET", body, schema, auth = true, idempotencyKey } = opts;

  const headers: Record<string, string> = { "content-type": "application/json" };
  if (auth) {
    const access = tokenStore.getAccess();
    if (access) headers.authorization = `Bearer ${access}`;
  }
  if (idempotencyKey) headers["idempotency-key"] = idempotencyKey;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Refresh once on a 401, then replay the original request.
  if (res.status === 401 && auth && !opts._retried) {
    if (await refreshAccessToken()) {
      return apiFetch(path, { ...opts, _retried: true });
    }
  }

  const json = (await res.json().catch(() => null)) as unknown;

  if (!res.ok) {
    const parsed = ErrorResponse.safeParse(json);
    if (parsed.success) {
      throw new ApiError(parsed.data.error.code, parsed.data.error.message, res.status);
    }
    throw new ApiError("INTERNAL_ERROR", "Couldn't reach the shop.", res.status);
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "Unexpected response from the server.", res.status);
  }
  return parsed.data;
}
