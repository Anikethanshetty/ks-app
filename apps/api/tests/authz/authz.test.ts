import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startInfra, type Infra } from "../helpers/infra.js";

/**
 * ⭐ The authorization test suite (TRD §9.2 / schema §5.4) — a release gate.
 *
 * Four real authenticated clients hit the real Fastify app via app.inject:
 *   A = customer, B = customer, D = delivery, admin.
 * Every hostile attempt must fail with 404 or 403 — never with another user's
 * data. RLS is gone; this suite is what stands between customers and each other.
 *
 * Endpoints that don't exist yet (invoices, collect-cod, /admin/*, payment
 * proofs) are listed as `it.todo` so the gate stays visible and each is filled
 * in when its endpoint lands.
 */

type App = Awaited<ReturnType<typeof import("../../src/server.js")["buildServer"]>>;
type Prisma = typeof import("../../src/lib/prisma.js")["prisma"];

let infra: Infra;
let app: App;
let prisma: Prisma;

type Session = { accessToken: string; refreshToken: string; userId: string };

const V1 = "/api/v1";

async function login(phone: string): Promise<Session> {
  await app.inject({ method: "POST", url: `${V1}/auth/otp/request`, payload: { phone } });
  const res = await app.inject({
    method: "POST",
    url: `${V1}/auth/otp/verify`,
    payload: { phone, code: "000000" },
  });
  const body = res.json();
  return {
    accessToken: body.accessToken,
    refreshToken: body.refreshToken,
    userId: body.user.id,
  };
}

function auth(token: string) {
  return { authorization: `Bearer ${token}` };
}

/** Forge an EXPIRED but correctly-signed access token for a user. */
function expiredToken(sub: string, role: string): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: "HS256", typ: "JWT" })}.${b64({ sub, role, iat: now - 3600, exp: now - 1800 })}`;
  const sig = createHmac("sha256", process.env.JWT_ACCESS_SECRET!)
    .update(body)
    .digest("base64url");
  return `${body}.${sig}`;
}

let A: Session;
let B: Session;
let D: Session;
let ADMIN: Session;
let aOrderId: string;

beforeAll(async () => {
  infra = await startInfra();
  ({ prisma } = await import("../../src/lib/prisma.js"));
  const { buildServer } = await import("../../src/server.js");
  app = await buildServer();
  await app.ready();

  await prisma.shopSettings.create({
    data: { id: 1, shopPhone: "+919000000000", shopAddress: "Mysuru" },
  });

  // Pre-seed the privileged roles so OTP login returns the right role.
  await prisma.user.create({ data: { phone: "+919000000020", role: "delivery" } });
  await prisma.user.create({ data: { phone: "+919000000030", role: "admin" } });

  A = await login("+919000000011"); // customer (auto-created)
  B = await login("+919000000012"); // customer (auto-created)
  D = await login("+919000000020"); // delivery
  ADMIN = await login("+919000000030"); // admin

  // A gets an address and places a real order (stock seeded).
  const category = await prisma.category.create({
    data: { slug: "rice", nameEn: "Rice", nameKn: "ಅಕ್ಕಿ", nameHi: "चावल" },
  });
  const product = await prisma.product.create({
    data: { categoryId: category.id, nameEn: "Rice", nameKn: "ಅಕ್ಕಿ", nameHi: "चावल" },
  });
  const variant = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: "SKU-AUTHZ",
      packSize: 1,
      unit: "kg",
      packLabel: "1 kg",
      mrp: 50,
      sellingPrice: 50,
      stock: 10,
    },
  });
  const address = await prisma.address.create({
    data: { userId: A.userId, line1: "1 Main Rd", area: "Kuvempunagar", pincode: "570023" },
  });
  const placed = await app.inject({
    method: "POST",
    url: `${V1}/orders`,
    headers: auth(A.accessToken),
    payload: {
      addressId: address.id,
      paymentMethod: "cod",
      items: [{ variantId: variant.id, quantity: 1 }],
    },
  });
  aOrderId = placed.json().id;
}, 180_000);

afterAll(async () => {
  await app?.close();
  await prisma?.$disconnect();
  await infra?.stop();
});

describe("authz — orders", () => {
  it("A can read her own order (control)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/orders/${aOrderId}`,
      headers: auth(A.accessToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it("B cannot GET A's order → 404 (not 403 — don't leak existence)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/orders/${aOrderId}`,
      headers: auth(B.accessToken),
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe("NOT_FOUND");
  });

  it("A (customer) cannot PATCH order status at all → 403", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${V1}/orders/${aOrderId}/status`,
      headers: auth(A.accessToken),
      payload: { status: "packed" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("D cannot see an order not actively assigned to them → 404", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/orders/${aOrderId}`,
      headers: auth(D.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });

  it("D (once assigned) cannot move an order to 'confirmed' → 403", async () => {
    await prisma.deliveryAssignment.create({
      data: {
        orderId: aOrderId,
        deliveryUserId: D.userId,
        assignedBy: ADMIN.userId,
        isActive: true,
      },
    });
    const res = await app.inject({
      method: "PATCH",
      url: `${V1}/orders/${aOrderId}/status`,
      headers: auth(D.accessToken),
      payload: { status: "confirmed" },
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });
});

describe("authz — profile", () => {
  it("A cannot escalate via PATCH /me { role: 'admin' } — field is stripped", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${V1}/me`,
      headers: auth(A.accessToken),
      payload: { fullName: "Aisha", role: "admin" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("customer");
    const fresh = await prisma.user.findUniqueOrThrow({ where: { id: A.userId } });
    expect(fresh.role).toBe("customer");
  });
});

describe("authz — tokens", () => {
  it("no token → 401", async () => {
    const res = await app.inject({ method: "GET", url: `${V1}/me` });
    expect(res.statusCode).toBe(401);
  });

  it("garbage token → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/me`,
      headers: auth("not.a.jwt"),
    });
    expect(res.statusCode).toBe(401);
  });

  it("expired but correctly-signed token → 401 TOKEN_EXPIRED", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/me`,
      headers: auth(expiredToken(A.userId, "customer")),
    });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("TOKEN_EXPIRED");
  });

  it("a reused refresh token revokes the whole family", async () => {
    const s = await login("+919000000013");
    // Rotate once: RT1 → RT2.
    const r1 = await app.inject({
      method: "POST",
      url: `${V1}/auth/refresh`,
      payload: { refreshToken: s.refreshToken },
    });
    expect(r1.statusCode).toBe(200);
    const rt2 = r1.json().refreshToken;

    // Reuse the now-revoked RT1 → reuse detected.
    const reuse = await app.inject({
      method: "POST",
      url: `${V1}/auth/refresh`,
      payload: { refreshToken: s.refreshToken },
    });
    expect(reuse.statusCode).toBe(401);
    expect(reuse.json().error.code).toBe("REFRESH_REUSE_DETECTED");

    // The whole family is dead: RT2 no longer works either.
    const rt2res = await app.inject({
      method: "POST",
      url: `${V1}/auth/refresh`,
      payload: { refreshToken: rt2 },
    });
    expect(rt2res.statusCode).toBe(401);
  });
});

describe("authz — endpoints not yet built (fill in when they land)", () => {
  it.todo("A cannot GET B's invoice → 404");
  it.todo("D cannot collect-cod on an order that isn't theirs → 404");
  it.todo("nobody but admin can hit any /admin/* route → 403");
  it.todo("A cannot fetch B's payment-proof (presigned, scoped, expiring)");
});
