import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { AddToCartBody, CartDto, CartCountDto, UpdateCartItemBody, OkResponse } from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { cartRepository } from "../repositories/cart.repository.js";

const ItemIdParam = z.object({ itemId: z.string().uuid() });

export const cartRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── Get cart ──
  app.get(
    "/cart",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["cart"],
        summary: "Get the current user's cart with all items",
        response: { 200: CartDto },
      },
    },
    async (req) => {
      return cartRepository.getCartSummary(req.actor!);
    },
  );

  // ── Add to cart ──
  app.post(
    "/cart/add",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["cart"],
        summary: "Add an item to the cart (increments quantity if already present)",
        body: AddToCartBody,
        response: { 200: CartDto },
      },
    },
    async (req) => {
      await cartRepository.addItem(
        req.actor!,
        req.body.variantId,
        req.body.quantity,
        req.body.addedVia,
      );
      return cartRepository.getCartSummary(req.actor!);
    },
  );

  // ── Update cart item quantity ──
  app.patch(
    "/cart/:itemId",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["cart"],
        summary: "Update the quantity of a cart item",
        params: ItemIdParam,
        body: UpdateCartItemBody,
        response: { 200: CartDto },
      },
    },
    async (req) => {
      const updated = await cartRepository.updateItem(
        req.actor!,
        req.params.itemId,
        req.body.quantity,
      );
      if (!updated) throw new AppError("NOT_FOUND", "Cart item not found.");
      return cartRepository.getCartSummary(req.actor!);
    },
  );

  // ── Remove from cart ──
  app.delete(
    "/cart/:itemId",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["cart"],
        summary: "Remove an item from the cart",
        params: ItemIdParam,
        response: { 200: CartDto },
      },
    },
    async (req) => {
      const removed = await cartRepository.removeItem(req.actor!, req.params.itemId);
      if (!removed) throw new AppError("NOT_FOUND", "Cart item not found.");
      return cartRepository.getCartSummary(req.actor!);
    },
  );

  // ── Cart count (for badge) ──
  app.get(
    "/cart/count",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["cart"],
        summary: "Get the number of items in the cart",
        response: { 200: CartCountDto },
      },
    },
    async (req) => {
      const count = await cartRepository.getItemCount(req.actor!);
      return { count };
    },
  );
};
