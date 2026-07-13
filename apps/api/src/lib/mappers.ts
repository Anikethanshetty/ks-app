import type { User } from "@prisma/client";
import type { InventoryVariantDto, OrderDto, OrderSummaryDto, PublicUser } from "@kss/shared";
import { toPaise } from "./money.js";
import type { OrderWithItems } from "../repositories/order.repository.js";
import type { InventoryRow } from "../repositories/inventory.repository.js";

/** The only shape of a user the API ever returns to a client. */
export function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    phone: u.phone,
    fullName: u.fullName,
    role: u.role,
    language: u.language as PublicUser["language"],
  };
}

/** Full order → DTO, all money converted to integer paise. */
export function toOrderDto(o: OrderWithItems): OrderDto {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    source: o.source,
    paymentMethod: o.paymentMethod,
    subtotalPaise: toPaise(o.subtotal),
    deliveryFeePaise: toPaise(o.deliveryFee),
    discountPaise: toPaise(o.discount),
    totalPaise: toPaise(o.total),
    deliverySlot: o.deliverySlot,
    customerNote: o.customerNote,
    addressSnapshot: o.addressSnapshot as Record<string, unknown>,
    placedAt: o.placedAt.toISOString(),
    items: o.items.map((it) => ({
      id: it.id,
      variantId: it.variantId,
      quantity: Number(it.quantity),
      unitPricePaise: toPaise(it.unitPrice),
      lineTotalPaise: toPaise(it.lineTotal),
      productNameEn: it.productNameEn,
      productNameKn: it.productNameKn,
      productNameHi: it.productNameHi,
      packLabel: it.packLabel,
      addedVia: it.addedVia,
    })),
    statusEvents: o.statusEvents.map((e) => ({
      status: e.status,
      actorId: e.actorId,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export function toOrderSummaryDto(o: OrderWithItems): OrderSummaryDto {
  const { items: _items, addressSnapshot: _addr, statusEvents: _events, ...rest } = toOrderDto(o);
  return rest as OrderSummaryDto;
}

/** Raw-SQL inventory row → DTO. Stock buckets are computed here, not stored. */
export function toInventoryVariantDto(row: InventoryRow): InventoryVariantDto {
  const stock = Number(row.stock);
  const lowStockThreshold = Number(row.lowStockThreshold);
  return {
    id: row.id,
    productId: row.productId,
    productNameEn: row.productNameEn,
    productNameKn: row.productNameKn,
    productNameHi: row.productNameHi,
    categoryNameEn: row.categoryNameEn,
    packLabel: row.packLabel,
    sku: row.sku,
    mrpPaise: toPaise(row.mrp),
    sellingPricePaise: toPaise(row.sellingPrice),
    stock,
    lowStockThreshold,
    isLowStock: stock > 0 && stock <= lowStockThreshold,
    isOutOfStock: stock <= 0,
    isActive: row.isActive,
  };
}
