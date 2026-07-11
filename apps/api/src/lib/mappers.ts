import type { User } from "@prisma/client";
import type { OrderDto, OrderSummaryDto, PublicUser } from "@kss/shared";
import { toPaise } from "./money.js";
import type { OrderWithItems } from "../repositories/order.repository.js";

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
  };
}

export function toOrderSummaryDto(o: OrderWithItems): OrderSummaryDto {
  const { items: _items, addressSnapshot: _addr, ...rest } = toOrderDto(o);
  return rest;
}
