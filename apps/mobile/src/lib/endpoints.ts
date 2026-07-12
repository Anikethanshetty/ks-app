import { z } from "zod";
import {
  AddressDto,
  AddressListResponse,
  AdjustStockBody,
  AdjustStockResponse,
  AliasDto,
  AuthTokens,
  CartDto,
  CartCountDto,
  CatalogueCategoryDto,
  CatalogueProductListResponse,
  CategoriesResponse,
  CategoryDto,
  CreateAddressBody,
  CreateAliasBody,
  CreateProductBody,
  CreateVariantBody,
  HealthResponse,
  ImportCommitResponse,
  ImportPreviewResponse,
  InventoryListResponse,
  InventoryTab,
  MePatchBody,
  OkResponse,
  OrderDto,
  OrderPreviewDto,
  OtpRequestResponse,
  ProductDetailDto,
  ProductDto,
  PublicUser,
  SearchResponse,
  ShopSettingsDto,
  UpdateAddressBody,
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

  // ── CSV import (T1.5, A08) ──
  importPreview: (csv: string) =>
    apiFetch("/admin/inventory/import/preview", {
      method: "POST",
      body: { csv },
      schema: ImportPreviewResponse,
    }),

  importCommit: (csv: string) =>
    apiFetch("/admin/inventory/import/commit", {
      method: "POST",
      body: { csv },
      schema: ImportCommitResponse,
    }),
};

/** Customer catalogue endpoints (T1.6). Accessible to any authenticated role. */
export const cartApi = {
  getCart: () => apiFetch("/cart", { schema: CartDto }),

  getCartCount: () => apiFetch("/cart/count", { schema: CartCountDto }),

  addToCart: (variantId: string, quantity: number) =>
    apiFetch("/cart/add", {
      method: "POST",
      body: { variantId, quantity },
      schema: CartDto,
    }),

  updateCartItem: (itemId: string, quantity: number) =>
    apiFetch(`/cart/${itemId}`, {
      method: "PATCH",
      body: { quantity },
      schema: CartDto,
    }),

  removeCartItem: (itemId: string) =>
    apiFetch(`/cart/${itemId}`, {
      method: "DELETE",
      schema: CartDto,
    }),
};

export const catalogueApi = {
  listCategories: () =>
    apiFetch("/categories", { schema: CategoriesResponse }),

  listProducts: (categoryId: string, page = 1, pageSize = 50) =>
    apiFetch(`/products?categoryId=${categoryId}&page=${page}&pageSize=${pageSize}`, {
      schema: CatalogueProductListResponse,
    }),

  getProduct: (id: string) =>
    apiFetch(`/products/${id}`, { schema: ProductDetailDto }),

  search: (q: string, lang = "kn", limit = 20) =>
    apiFetch(`/search?q=${encodeURIComponent(q)}&lang=${lang}&limit=${limit}`, {
      schema: SearchResponse,
    }),
};

/** Address + checkout endpoints (T2.2). */
export const addressApi = {
  list: () => apiFetch("/addresses", { schema: AddressListResponse }),

  create: (body: z.infer<typeof CreateAddressBody>) =>
    apiFetch("/addresses", { method: "POST", body, schema: AddressDto }),

  update: (id: string, body: z.infer<typeof UpdateAddressBody>) =>
    apiFetch(`/addresses/${id}`, { method: "PATCH", body, schema: AddressDto }),

  delete: (id: string) =>
    apiFetch(`/addresses/${id}`, { method: "DELETE", schema: OkResponse }),
};

export const shopApi = {
  getSettings: () => apiFetch("/shop/settings", { schema: ShopSettingsDto }),
};

export const orderApi = {
  preview: (addressId: string) =>
    apiFetch(`/orders/preview?addressId=${addressId}`, { schema: OrderPreviewDto }),

  place: (body: { addressId: string; paymentMethod: "cod" | "upi"; note?: string }) =>
    apiFetch("/orders", {
      method: "POST",
      body,
      schema: OrderDto,
    }),

  get: (id: string) => apiFetch(`/orders/${id}`, { schema: OrderDto }),

  list: (cursor?: string) =>
    apiFetch(`/orders${cursor ? `?cursor=${cursor}` : ""}`, {
      schema: z.object({ items: z.array(z.any()), nextCursor: z.string().nullable() }),
    }),

  cancel: (id: string, reason?: string) =>
    apiFetch(`/orders/${id}/cancel`, {
      method: "POST",
      body: { reason },
      schema: OrderDto,
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
