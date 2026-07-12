import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

export type CartItemRow = {
  id: string;
  variantId: string;
  productId: string;
  productNameEn: string;
  productNameKn: string;
  productNameHi: string;
  packLabel: string;
  packSize: string;
  unit: string;
  quantity: string;
  mrp: string;
  sellingPrice: string;
  stock: string;
  addedVia: string;
};

function toCartItemRow(row: CartItemRow) {
  const sellingPrice = Number(row.sellingPrice);
  const qty = Number(row.quantity);
  return {
    id: row.id,
    variantId: row.variantId,
    productId: row.productId,
    productNameEn: row.productNameEn,
    productNameKn: row.productNameKn,
    productNameHi: row.productNameHi,
    packLabel: row.packLabel,
    packSize: Number(row.packSize),
    unit: row.unit,
    quantity: qty,
    mrpPaise: Math.round(Number(row.mrp) * 100),
    sellingPricePaise: Math.round(sellingPrice * 100),
    lineTotalPaise: Math.round(sellingPrice * qty * 100),
    stock: Number(row.stock),
    addedVia: row.addedVia as import("@prisma/client").$Enums.OrderSource,
  };
}

export const cartRepository = {
  /** Get or create a cart for the actor and return it with items. */
  async getCart(_actor: Actor) {
    // Ensure the cart row exists
    await prisma.cart.upsert({
      where: { userId: _actor.userId },
      update: {},
      create: { userId: _actor.userId },
    });

    const rows: CartItemRow[] = await prisma.$queryRaw`
      SELECT
        ci.id,
        ci.variant_id::text                 AS "variantId",
        p.id::text                          AS "productId",
        p.name_en::text                     AS "productNameEn",
        p.name_kn::text                     AS "productNameKn",
        p.name_hi::text                     AS "productNameHi",
        v.pack_label::text                  AS "packLabel",
        v.pack_size::text                   AS "packSize",
        v.unit::text                        AS "unit",
        ci.quantity::text                   AS "quantity",
        v.mrp::text                         AS "mrp",
        v.selling_price::text               AS "sellingPrice",
        v.stock::text                       AS "stock",
        ci.added_via::text                  AS "addedVia"
      FROM cart_items ci
      JOIN carts c ON c.id = ci.cart_id
      JOIN product_variants v ON v.id = ci.variant_id
      JOIN products p ON p.id = v.product_id
      WHERE c.user_id = ${_actor.userId}::uuid
      ORDER BY ci.created_at ASC
    `;

    return rows.map(toCartItemRow);
  },

  /** Get the cart with item count and subtotal. */
  async getCartSummary(_actor: Actor): Promise<{ items: ReturnType<typeof toCartItemRow>[]; itemCount: number; subtotalPaise: number }> {
    const items = await this.getCart(_actor);
    const itemCount = items.length;
    const subtotalPaise = items.reduce((sum, it) => sum + (it.lineTotalPaise ?? 0), 0);
    return { items, itemCount, subtotalPaise };
  },

  /** Add an item to the cart. If the variant is already in the cart, increment the quantity. */
  async addItem(_actor: Actor, variantId: string, quantity: number, addedVia: string) {
    const cart = await prisma.cart.upsert({
      where: { userId: _actor.userId },
      update: {},
      create: { userId: _actor.userId },
    });

    // Check if the variant is already in the cart
    const existing = await prisma.cartItem.findUnique({
      where: { cartId_variantId: { cartId: cart.id, variantId } },
    });

    if (existing) {
      await prisma.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity.add(quantity) },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          variantId,
          quantity,
          addedVia: addedVia as import("@prisma/client").$Enums.OrderSource,
        },
      });
    }
  },

  /** Update the quantity of a cart item. Only succeeds if it belongs to the actor. */
  async updateItem(_actor: Actor, itemId: string, quantity: number) {
    // Verify ownership via JOIN
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId: _actor.userId } },
    });
    if (!item) return false;

    await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity },
    });
    return true;
  },

  /** Remove an item from the cart. Only succeeds if it belongs to the actor. */
  async removeItem(_actor: Actor, itemId: string) {
    const item = await prisma.cartItem.findFirst({
      where: { id: itemId, cart: { userId: _actor.userId } },
    });
    if (!item) return false;

    await prisma.cartItem.delete({ where: { id: itemId } });
    return true;
  },

  /** Get the item count for the badge. */
  async getItemCount(_actor: Actor): Promise<number> {
    const count = await prisma.cartItem.count({
      where: { cart: { userId: _actor.userId } },
    });
    return count;
  },
};
