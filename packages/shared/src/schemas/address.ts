import { z } from "zod";

// ─────────────────────────── address schemas (T2.2) ───────────────────────────

export const AddressDto = z.object({
  id: z.string().uuid(),
  label: z.string().nullable(),
  line1: z.string(),
  line2: z.string().nullable(),
  area: z.string(),
  landmark: z.string().nullable(),
  city: z.string(),
  pincode: z.string(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  isDefault: z.boolean(),
});
export type AddressDto = z.infer<typeof AddressDto>;

export const CreateAddressBody = z.object({
  label: z.string().min(1).max(50).optional(),
  line1: z.string().min(1).max(200),
  line2: z.string().max(200).optional(),
  area: z.string().min(1).max(100),
  landmark: z.string().max(200).optional(),
  city: z.string().min(1).max(100).default("Mysuru"),
  pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  isDefault: z.boolean().optional(),
});
export type CreateAddressBody = z.infer<typeof CreateAddressBody>;

export const UpdateAddressBody = CreateAddressBody.partial();
export type UpdateAddressBody = z.infer<typeof UpdateAddressBody>;

export const AddressListResponse = z.object({
  items: z.array(AddressDto),
});
export type AddressListResponse = z.infer<typeof AddressListResponse>;

// ─────────────────────────── order preview (T2.2) ───────────────────────────

/** A single item in the order preview, server-computed from current cart. */
export const PreviewItemDto = z.object({
  variantId: z.string().uuid(),
  productNameEn: z.string(),
  productNameKn: z.string(),
  productNameHi: z.string(),
  packLabel: z.string(),
  quantity: z.number().positive(),
  unitPricePaise: z.number().int().nonnegative(),
  lineTotalPaise: z.number().int().nonnegative(),
  available: z.number(),
  inStock: z.boolean(),
});
export type PreviewItemDto = z.infer<typeof PreviewItemDto>;

export const OrderPreviewDto = z.object({
  items: z.array(PreviewItemDto),
  itemCount: z.number().int().nonnegative(),
  subtotalPaise: z.number().int().nonnegative(),
  deliveryFeePaise: z.number().int().nonnegative(),
  freeDeliveryAbovePaise: z.number().int().nonnegative(),
  totalPaise: z.number().int().nonnegative(),
  codLimitPaise: z.number().int().nonnegative(),
  codExceeded: z.boolean(),
  isAcceptingOrders: z.boolean(),
  shopName: z.string(),
});
export type OrderPreviewDto = z.infer<typeof OrderPreviewDto>;

/** Shop settings visible to customers. */
export const ShopSettingsDto = z.object({
  shopName: z.string(),
  shopPhone: z.string(),
  deliveryFeePaise: z.number().int().nonnegative(),
  freeDeliveryAbovePaise: z.number().int().nonnegative(),
  deliveryRadiusKm: z.number(),
  codLimitPaise: z.number().int().nonnegative(),
  isOpen: z.boolean(),
  acceptingOrders: z.boolean(),
  upiVpa: z.string().nullable(),
  upiPayeeName: z.string().nullable(),
});
export type ShopSettingsDto = z.infer<typeof ShopSettingsDto>;
