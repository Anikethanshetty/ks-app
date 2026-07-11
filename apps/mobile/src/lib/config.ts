/** Public runtime config. Nothing here is secret (TRD §2.3). */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8080/api/v1";

export const WS_URL = process.env.EXPO_PUBLIC_WS_URL ?? "ws://localhost:8080";

/** Server origin without the /api/v1 prefix — for /health and /ready. */
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");
