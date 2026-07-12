import { z } from "zod";
import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import {
  AddressDto,
  AddressListResponse,
  CreateAddressBody,
  OkResponse,
  UpdateAddressBody,
} from "@kss/shared";
import { AppError } from "../lib/errors.js";
import { authenticate } from "../middleware/authenticate.js";
import { authorize } from "../middleware/authorize.js";
import { addressRepository } from "../repositories/address.repository.js";

const IdParam = z.object({ id: z.string().uuid() });

function toAddressDto(a: NonNullable<Awaited<ReturnType<typeof addressRepository.findById>>>): z.infer<typeof AddressDto> {
  return {
    id: a.id,
    label: a.label,
    line1: a.line1,
    line2: a.line2,
    area: a.area,
    landmark: a.landmark,
    city: a.city,
    pincode: a.pincode,
    latitude: a.latitude,
    longitude: a.longitude,
    isDefault: a.isDefault,
  };
}

export const addressRoutes: FastifyPluginAsyncZod = async (app) => {
  app.addHook("preHandler", authenticate);

  // ── List addresses ──
  app.get(
    "/addresses",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["addresses"],
        summary: "List the current user's addresses",
        response: { 200: AddressListResponse },
      },
    },
    async (req) => {
      const addresses = await addressRepository.list(req.actor!);
      return { items: addresses.map(toAddressDto) };
    },
  );

  // ── Create address ──
  app.post(
    "/addresses",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["addresses"],
        summary: "Create a new address",
        body: CreateAddressBody,
        response: { 200: AddressDto },
      },
    },
    async (req) => {
      const address = await addressRepository.create(req.actor!, req.body);
      return toAddressDto(address);
    },
  );

  // ── Update address ──
  app.patch(
    "/addresses/:id",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["addresses"],
        summary: "Update an address",
        params: IdParam,
        body: UpdateAddressBody,
        response: { 200: AddressDto },
      },
    },
    async (req) => {
      const address = await addressRepository.update(req.actor!, req.params.id, req.body);
      if (!address) throw new AppError("NOT_FOUND", "Address not found.");
      return toAddressDto(address);
    },
  );

  // ── Delete address ──
  app.delete(
    "/addresses/:id",
    {
      preHandler: authorize("customer", "admin"),
      schema: {
        tags: ["addresses"],
        summary: "Delete an address",
        params: IdParam,
        response: { 200: OkResponse },
      },
    },
    async (req) => {
      const deleted = await addressRepository.delete(req.actor!, req.params.id);
      if (!deleted) throw new AppError("NOT_FOUND", "Address not found.");
      return { ok: true as const };
    },
  );
};
