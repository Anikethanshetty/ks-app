import type { AdjustStockBody } from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

type MovementReason = import("@prisma/client").$Enums.MovementReason;

export const inventoryService = {
  /**
   * Adjust stock for a variant. Writes an inventory_movement and updates the
   * variant's stock in a single transaction (TRD §6.4).
   *
   * - stock_in  (purchase): delta = +qty
   * - stock_out (damage/expiry/shop_use): delta = -qty, requires stock >= qty
   * - correction (correction): delta = countedStock - currentStock
   */
  async adjustStock(actor: Actor, input: AdjustStockBody) {
    return prisma.$transaction(
      async (tx) => {
        const variant = await tx.productVariant.findUnique({
          where: { id: input.variantId },
        });
        if (!variant) throw new AppError("VARIANT_NOT_FOUND", "Variant not found.");
        if (!variant.isActive) throw new AppError("VARIANT_NOT_FOUND", "Variant is not active.");

        const currentStock = Number(variant.stock);
        let delta: number;
        let reason: MovementReason;
        let note: string | null = null;

        switch (input.type) {
          case "stock_in": {
            delta = input.quantity;
            reason = "purchase";
            note = input.note ?? null;
            break;
          }
          case "stock_out": {
            if (currentStock < input.quantity) {
              throw new AppError("OUT_OF_STOCK", "Not enough stock to remove.", {
                available: currentStock,
                requested: input.quantity,
              });
            }
            delta = -input.quantity;
            reason = input.reason;
            note = input.note ?? null;
            break;
          }
          case "correction": {
            delta = input.countedStock - currentStock;
            reason = "correction";
            note = input.note ?? null;
            break;
          }
        }

        const newStock = currentStock + delta;

        // Update variant stock
        await tx.productVariant.update({
          where: { id: input.variantId },
          data: { stock: newStock },
        });

        // Write inventory movement
        await tx.inventoryMovement.create({
          data: {
            variantId: input.variantId,
            delta,
            reason,
            note,
            actorId: actor.userId,
          },
        });

        return {
          variantId: input.variantId,
          previousStock: currentStock,
          newStock,
          delta,
          reason,
        };
      },
      { timeout: 10_000 },
    );
  },
};
