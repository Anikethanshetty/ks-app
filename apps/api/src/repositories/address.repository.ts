import { prisma } from "../lib/prisma.js";
import type { Actor } from "../types/actor.js";

export const addressRepository = {
  /** List addresses for the actor. */
  async list(_actor: Actor) {
    return prisma.address.findMany({
      where: { userId: _actor.userId },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
    });
  },

  /** Get a single address — only if it belongs to the actor. */
  async findById(_actor: Actor, id: string) {
    return prisma.address.findFirst({
      where: { id, userId: _actor.userId },
    });
  },

  /** Create an address for the actor. */
  async create(
    _actor: Actor,
    data: {
      label?: string;
      line1: string;
      line2?: string;
      area: string;
      landmark?: string;
      city: string;
      pincode: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    },
  ) {
    // If setting as default, unset any existing default first
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: _actor.userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return prisma.address.create({
      data: {
        userId: _actor.userId,
        label: data.label ?? null,
        line1: data.line1,
        line2: data.line2 ?? null,
        area: data.area,
        landmark: data.landmark ?? null,
        city: data.city,
        pincode: data.pincode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        isDefault: data.isDefault ?? false,
      },
    });
  },

  /** Update an address — only if it belongs to the actor. */
  async update(
    _actor: Actor,
    id: string,
    data: {
      label?: string;
      line1?: string;
      line2?: string;
      area?: string;
      landmark?: string;
      city?: string;
      pincode?: string;
      latitude?: number;
      longitude?: number;
      isDefault?: boolean;
    },
  ) {
    // Verify ownership
    const existing = await prisma.address.findFirst({
      where: { id, userId: _actor.userId },
    });
    if (!existing) return null;

    // If setting as default, unset any existing default first
    if (data.isDefault) {
      await prisma.address.updateMany({
        where: { userId: _actor.userId, isDefault: true, id: { not: id } },
        data: { isDefault: false },
      });
    }

    return prisma.address.update({ where: { id }, data });
  },

  /** Delete an address — only if it belongs to the actor. */
  async delete(_actor: Actor, id: string) {
    const existing = await prisma.address.findFirst({
      where: { id, userId: _actor.userId },
    });
    if (!existing) return false;

    await prisma.address.delete({ where: { id } });
    return true;
  },
};
