import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { GenericContainer, type StartedTestContainer } from "testcontainers";
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";

// These are populated in beforeAll AFTER the container env is set, so the Prisma
// client and Redis client are constructed against the containers, not dev infra.
type Prisma = typeof import("../../src/lib/prisma.js")["prisma"];
type OrderService = typeof import("../../src/services/order.service.js")["orderService"];
type Actor = import("../../src/types/actor.js").Actor;

let pgC: StartedPostgreSqlContainer;
let redisC: StartedTestContainer;
let prisma: Prisma;
let orderService: OrderService;

let customer: Actor;
let admin: Actor;
let addressId: string;
let categoryId: string;

async function makeVariant(stock: number, price: number): Promise<string> {
  const product = await prisma.product.create({
    data: {
      categoryId,
      nameEn: "Rice",
      nameKn: "ಅಕ್ಕಿ",
      nameHi: "चावल",
    },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: `SKU-${randomUUID()}`,
      packSize: 1,
      unit: "kg",
      packLabel: "1 kg",
      mrp: price,
      sellingPrice: price,
      stock,
    },
  });
  // Opening stock is itself a movement (a 'purchase'), so the invariant
  // stock == sum(movements) holds from the start — as adjustStock would do.
  if (stock > 0) {
    await prisma.inventoryMovement.create({
      data: { variantId: variant.id, delta: stock, reason: "purchase" },
    });
  }
  return variant.id;
}

function orderInput(variantId: string, quantity: number) {
  return {
    addressId,
    paymentMethod: "cod" as const,
    items: [{ variantId, quantity }],
    source: "manual" as const,
  };
}

async function stockOf(variantId: string): Promise<number> {
  const v = await prisma.productVariant.findUniqueOrThrow({ where: { id: variantId } });
  return Number(v.stock);
}

async function movementSum(variantId: string): Promise<number> {
  const rows = await prisma.inventoryMovement.findMany({ where: { variantId } });
  return rows.reduce((acc, r) => acc + Number(r.delta), 0);
}

beforeAll(async () => {
  pgC = await new PostgreSqlContainer("postgres:16").start();
  redisC = await new GenericContainer("redis:7").withExposedPorts(6379).start();

  process.env.DATABASE_URL = pgC.getConnectionUri();
  process.env.REDIS_URL = `redis://${redisC.getHost()}:${redisC.getMappedPort(6379)}`;

  // Apply migrations to the fresh container DB.
  execSync("pnpm exec prisma migrate deploy", {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  // Import AFTER env is set so the singletons bind to the containers.
  ({ prisma } = await import("../../src/lib/prisma.js"));
  ({ orderService } = await import("../../src/services/order.service.js"));

  await prisma.shopSettings.create({
    data: { id: 1, shopPhone: "+919000000000", shopAddress: "Mysuru" },
  });
  const cust = await prisma.user.create({
    data: { phone: "+919000000010", role: "customer" },
  });
  const adm = await prisma.user.create({
    data: { phone: "+919000000030", role: "admin" },
  });
  customer = { userId: cust.id, role: "customer" };
  admin = { userId: adm.id, role: "admin" };
  const address = await prisma.address.create({
    data: {
      userId: cust.id,
      line1: "1 Main Rd",
      area: "Kuvempunagar",
      pincode: "570023",
    },
  });
  addressId = address.id;
  const category = await prisma.category.create({
    data: { slug: "rice", nameEn: "Rice", nameKn: "ಅಕ್ಕಿ", nameHi: "चावल" },
  });
  categoryId = category.id;
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await pgC?.stop();
  await redisC?.stop();
});

describe("orderService.placeOrder — the concurrency gate", () => {
  it("(a) ordering more than stock throws OUT_OF_STOCK and changes nothing", async () => {
    const v = await makeVariant(2, 50);
    await expect(orderService.placeOrder(customer, orderInput(v, 3))).rejects.toMatchObject({
      code: "OUT_OF_STOCK",
    });
    expect(await stockOf(v)).toBe(2); // unchanged
    expect(await prisma.order.count({ where: { items: { some: { variantId: v } } } })).toBe(0);
  });

  it("(b) ⭐ two concurrent orders for the last unit → one success, one OUT_OF_STOCK, stock lands at 0", async () => {
    const v = await makeVariant(1, 50);
    const results = await Promise.allSettled([
      orderService.placeOrder(customer, orderInput(v, 1)),
      orderService.placeOrder(customer, orderInput(v, 1)),
    ]);
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({ code: "OUT_OF_STOCK" });
    expect(await stockOf(v)).toBe(0);
  });

  it("(f) after placeOrder, stock == sum(inventory_movements.delta)", async () => {
    const v = await makeVariant(10, 50);
    await orderService.placeOrder(customer, orderInput(v, 3));
    expect(await stockOf(v)).toBe(7);
    expect(await movementSum(v)).toBe(7);
  });

  it("(d) a replayed Idempotency-Key is a no-op returning the original response", async () => {
    const v = await makeVariant(10, 50);
    const key = randomUUID();
    const first = await orderService.placeOrder(customer, orderInput(v, 2), key);
    const second = await orderService.placeOrder(customer, orderInput(v, 2), key);
    expect(second.id).toBe(first.id); // same order, not a new one
    expect(await prisma.order.count({ where: { items: { some: { variantId: v } } } })).toBe(1);
    expect(await stockOf(v)).toBe(8); // decremented once only
  });
});

describe("orderService.updateStatus / cancel", () => {
  it("(c) a backwards / skipping transition throws INVALID_TRANSITION", async () => {
    const v = await makeVariant(5, 50);
    const order = await orderService.placeOrder(customer, orderInput(v, 1)); // → confirmed
    // confirmed → out_for_delivery skips 'packed' and is not in the table.
    await expect(
      orderService.updateStatus(admin, order.id, "out_for_delivery", undefined, undefined),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("(e) cancelling restores stock and writes a compensating movement", async () => {
    const v = await makeVariant(5, 50);
    const order = await orderService.placeOrder(customer, orderInput(v, 2));
    expect(await stockOf(v)).toBe(3);

    await orderService.cancel(customer, order.id, "changed my mind");
    expect(await stockOf(v)).toBe(5); // restored

    const returns = await prisma.inventoryMovement.count({
      where: { variantId: v, reason: "return" },
    });
    expect(returns).toBe(1);
    expect(await movementSum(v)).toBe(5); // invariant still holds
  });
});
