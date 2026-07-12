import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AdjustStockBody,
  AdjustStockResponse,
  ImportCsvBody,
  ImportPreviewResponse,
  ImportCommitResponse,
  InventoryListResponse,
  InventoryTab,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { inventoryRepository } from "../repositories/inventory.repository.js";
import { inventoryService } from "../services/inventory.service.js";
import { importService } from "../services/import.service.js";
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

  // ── CSV import (T1.5, A08) ──
  app.post(
    "/admin/inventory/import/preview",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "inventory"],
        summary: "Preview a CSV import — parse, validate, return row-level results",
        body: ImportCsvBody,
        response: { 200: ImportPreviewResponse },
      },
    },
    async (req) => {
      const result = await importService.preview(req.body.csv);
      return result as z.infer<typeof ImportPreviewResponse>;
    },
  );

  app.post(
    "/admin/inventory/import/commit",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "inventory"],
        summary: "Commit a CSV import — create products, variants, and aliases",
        body: ImportCsvBody,
        response: { 200: ImportCommitResponse },
      },
    },
    async (req) => {
      const result = await importService.commit(req.actor!, req.body.csv);
      return result as z.infer<typeof ImportCommitResponse>;
    },
  );

  // ── Stock adjust (T1.4, A07) ──
  app.post(
    "/admin/inventory/adjust",
    {
      preHandler: authorize("admin"),
      schema: {
        tags: ["admin", "inventory"],
        summary: "Adjust stock: stock in / stock out / correction (A07)",
        body: AdjustStockBody,
        response: { 200: AdjustStockResponse },
      },
    },
    async (req) => {
      return inventoryService.adjustStock(req.actor!, req.body);
    },
  );
};
