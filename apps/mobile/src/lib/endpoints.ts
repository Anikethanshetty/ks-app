import { z } from "zod";
import {
  AdjustStockBody,
  AdjustStockResponse,
  AliasDto,
  AuthTokens,
  CategoryDto,
  CreateAliasBody,
  CreateProductBody,
  CreateVariantBody,
  HealthResponse,
  InventoryListResponse,
  InventoryTab,
  MePatchBody,
  OkResponse,
  OtpRequestResponse,
  ProductDto,
  PublicUser,
  UpdateProductBody,
  UpdateVariantBody,
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

export const inventoryApi = {
  list: (tab: InventoryTab, page: number, pageSize = 50) =>
    apiFetch(`/admin/inventory?tab=${tab}&page=${page}&pageSize=${pageSize}`, {
      schema: InventoryListResponse,
    }),

  // ── Stock adjust (T1.4, A07) ──
  adjustStock: (body: z.infer<typeof AdjustStockBody>) =>
    apiFetch("/admin/inventory/adjust", {
      method: "POST",
      body,
      schema: AdjustStockResponse,
    }),
};

export const productApi = {
  listCategories: () => apiFetch("/admin/categories", { schema: z.object({ items: z.array(CategoryDto) }) }),

  get: (id: string) => apiFetch(`/admin/products/${id}`, { schema: ProductDto }),

  create: (body: z.infer<typeof CreateProductBody> & { variants?: z.infer<typeof CreateVariantBody>[] }) =>
    apiFetch("/admin/products", {
      method: "POST",
      body,
      schema: ProductDto,
    }),

  update: (id: string, body: z.infer<typeof UpdateProductBody>) =>
    apiFetch(`/admin/products/${id}`, {
      method: "PATCH",
      body,
      schema: ProductDto,
    }),

  addVariant: (productId: string, body: z.infer<typeof CreateVariantBody>) =>
    apiFetch(`/admin/products/${productId}/variants`, {
      method: "POST",
      body,
      schema: ProductDto,
    }),

  updateVariant: (productId: string, variantId: string, body: z.infer<typeof UpdateVariantBody>) =>
    apiFetch(`/admin/products/${productId}/variants/${variantId}`, {
      method: "PATCH",
      body,
      schema: ProductDto,
    }),

  // ── ⭐ Aliases (T1.3) ──

  listAliases: (productId: string) =>
    apiFetch(`/admin/products/${productId}/aliases`, {
      schema: z.object({ items: z.array(AliasDto) }),
    }),

  createAlias: (productId: string, body: z.infer<typeof CreateAliasBody>) =>
    apiFetch(`/admin/products/${productId}/aliases`, {
      method: "POST",
      body,
      schema: AliasDto,
    }),

  deleteAlias: (productId: string, aliasId: string) =>
    apiFetch(`/admin/products/${productId}/aliases/${aliasId}`, {
      method: "DELETE",
      schema: OkResponse,
    }),
};
