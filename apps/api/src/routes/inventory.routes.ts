import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { InventoryListResponse, InventoryTab } from "@kss/shared";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { inventoryRepository } from "../repositories/inventory.repository.js";
import { toInventoryVariantDto } from "../lib/mappers.js";

const ListQuery = z.object({
  tab: InventoryTab.default("all"),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export const inventoryRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  app.get(
    "/admin/inventory",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "inventory"],
        summary: "Admin inventory list, filterable by tab (A05)",
        querystring: ListQuery,
        response: { 200: InventoryListResponse },
      },
    },
    async (req) => {
      const { tab, page, pageSize } = req.query;
      const [rows, counts] = await Promise.all([
        inventoryRepository.list(tab, page, pageSize),
        inventoryRepository.counts(),
      ]);
      return { items: rows.map(toInventoryVariantDto), page, pageSize, counts };
    },
  );
};
