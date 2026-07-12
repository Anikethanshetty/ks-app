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
 * Endpoints that don't exist yet (invoices, collect-cod, payment proofs) are
 * listed as `it.todo` so the gate stays visible and each is filled in when
 * its endpoint lands.
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

  it("D (role-permitted status) cannot skip the transition table → 400 INVALID_TRANSITION", async () => {
    // 'out_for_delivery' is a status delivery is allowed to set, but the order
    // is still 'confirmed' (needs 'packed' first) — the transition table, not
    // the role gate, must be what blocks this.
    const res = await app.inject({
      method: "PATCH",
      url: `${V1}/orders/${aOrderId}/status`,
      headers: auth(D.accessToken),
      payload: { status: "out_for_delivery" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("INVALID_TRANSITION");
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

describe("authz — admin routes", () => {
  it("customer cannot hit /admin/* → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/inventory`,
      headers: auth(A.accessToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("delivery cannot hit /admin/* → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/inventory`,
      headers: auth(D.accessToken),
    });
    expect(res.statusCode).toBe(403);
    expect(res.json().error.code).toBe("FORBIDDEN");
  });

  it("no token on /admin/* → 401", async () => {
    const res = await app.inject({ method: "GET", url: `${V1}/admin/inventory` });
    expect(res.statusCode).toBe(401);
  });

  it("admin can hit /admin/* (control)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/inventory`,
      headers: auth(ADMIN.accessToken),
    });
    expect(res.statusCode).toBe(200);
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
  it.todo("A cannot fetch B's payment-proof (presigned, scoped, expiring)");
  it.todo("A cannot GET B's products → 404");
});

describe("authz — admin products", () => {
  it("admin can GET admin categories (control)", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    expect(res.statusCode).toBe(200);
  });

  it("customer cannot GET admin categories → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(A.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it("delivery cannot GET admin categories → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(D.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it("no token on admin products → 401", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
    });
    expect(res.statusCode).toBe(401);
  });

  it("admin can create a product (control)", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz Test Product",
        nameKn: "ಆತ್ಜ್ ಟೆಸ್ಟ್ ಉತ್ಪನ್ನ",
        nameHi: "ऑथज़ टेस्ट उत्पाद",
        variants: [
          {
            sku: "SKU-AUTHZ-PROD",
            packSize: 1,
            unit: "kg",
            packLabel: "1 kg",
            mrpPaise: 10000,
            sellingPricePaise: 8500,
            stock: 100,
            lowStockThreshold: 5,
          },
        ],
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nameEn).toBe("Authz Test Product");
  });

  it("customer cannot create a product → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(A.accessToken),
      payload: {
        categoryId: "00000000-0000-0000-0000-000000000000",
        nameEn: "Should fail",
        nameKn: "ವಿಫಲ",
        nameHi: "विफल",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("delivery cannot create a product → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(D.accessToken),
      payload: {
        categoryId: "00000000-0000-0000-0000-000000000000",
        nameEn: "Should fail",
        nameKn: "ವಿಫಲ",
        nameHi: "विफल",
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can GET a product by id (control)", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const created = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz Get Test",
        nameKn: "ಆತ್ಜ್ ಗೆಟ್ ಟೆಸ್ಟ್",
        nameHi: "ऑथज़ गेट टेस्ट",
        variants: [
          {
            sku: "SKU-AUTHZ-GET",
            packSize: 1,
            unit: "piece",
            packLabel: "1 pc",
            mrpPaise: 5000,
            sellingPricePaise: 4000,
            stock: 10,
            lowStockThreshold: 3,
          },
        ],
      },
    });
    expect(created.statusCode).toBe(200);
    const productId = created.json().id;

    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/products/${productId}`,
      headers: auth(ADMIN.accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(productId);
  });

  it("customer cannot GET admin product → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/products/${aOrderId}`,
      headers: auth(A.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can PATCH a product (control)", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const created = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz Patch Test",
        nameKn: "ಆತ್ಜ್ ಪ್ಯಾಚ್ ಟೆಸ್ಟ್",
        nameHi: "ऑथज़ पैच टेस्ट",
        variants: [
          {
            sku: "SKU-AUTHZ-PATCH",
            packSize: 1,
            unit: "piece",
            packLabel: "1 pc",
            mrpPaise: 10000,
            sellingPricePaise: 8000,
            stock: 10,
            lowStockThreshold: 5,
          },
        ],
      },
    });
    const productId = created.json().id;

    const res = await app.inject({
      method: "PATCH",
      url: `${V1}/admin/products/${productId}`,
      headers: auth(ADMIN.accessToken),
      payload: { nameEn: "Authz Patch Updated" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nameEn).toBe("Authz Patch Updated");
  });

  it("customer cannot PATCH a product → 403", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `${V1}/admin/products/${aOrderId}`,
      headers: auth(A.accessToken),
      payload: { nameEn: "Should fail" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can add an alias (control)", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const created = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz Alias Test",
        nameKn: "ಆತ್ಜ್ ಅಲಿಯಾಸ್ ಟೆಸ್ಟ್",
        nameHi: "ऑथज़ उपनाम टेस्ट",
      },
    });
    const productId = created.json().id;

    // Add alias
    const added = await app.inject({
      method: "POST",
      url: `${V1}/admin/products/${productId}/aliases`,
      headers: auth(ADMIN.accessToken),
      payload: { alias: "akki" },
    });
    expect(added.statusCode).toBe(200);
    expect(added.json().alias).toBe("akki");

    // List aliases
    const listed = await app.inject({
      method: "GET",
      url: `${V1}/admin/products/${productId}/aliases`,
      headers: auth(ADMIN.accessToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().items).toHaveLength(1);

    // Delete alias
    const aliasId = added.json().id;
    const deleted = await app.inject({
      method: "DELETE",
      url: `${V1}/admin/products/${productId}/aliases/${aliasId}`,
      headers: auth(ADMIN.accessToken),
    });
    expect(deleted.statusCode).toBe(200);
  });

  it("customer cannot add an alias → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/products/${aOrderId}/aliases`,
      headers: auth(A.accessToken),
      payload: { alias: "test" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("delivery cannot list aliases → 403", async () => {
    const res = await app.inject({
      method: "GET",
      url: `${V1}/admin/products/${aOrderId}/aliases`,
      headers: auth(D.accessToken),
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can preview CSV import (control)", async () => {
    const csv = `name_en,name_kn,name_hi,category,pack_label,mrp,price,stock
Test Rice,ಟೆಸ್ಟ್ ಅಕ್ಕಿ,टेस्ट चावल,Rice,1 kg,100,90,50
Test Dal,ಟೆಸ್ಟ್ ಬೇಳೆ,टेस्ट दाल,Pulses,1 kg,120,110,30`;
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/import/preview`,
      headers: auth(ADMIN.accessToken),
      payload: { csv },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().totalRows).toBe(2);
    expect(res.json().validRows).toBe(2);
  });

  it("customer cannot preview CSV import → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/import/preview`,
      headers: auth(A.accessToken),
      payload: { csv: "name_en,name_kn,name_hi,category\nTest,Test,Test,Cat" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can commit CSV import (control)", async () => {
    const csv = `name_en,name_kn,name_hi,category,pack_label,unit,mrp,price,stock
CsvTest Rice,ಸಿಎಸ್ವಿ ಟೆಸ್ಟ್ ಅಕ್ಕि,सीएसवी टेस्ट चावल,TstCat,1 kg,kg,100,90,50
CsvTest Dal,ಸಿಎಸ್ವಿ ಟೆಸ್ಟ್ ಬೇಳೆ,सीएसवी टेस्ट दाल,TstCat,1 kg,kg,120,110,30`;
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/import/commit`,
      headers: auth(ADMIN.accessToken),
      payload: { csv },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().productsCreated).toBe(2);
    expect(res.json().variantsCreated).toBe(2);
  });

  it("customer cannot commit CSV import → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/import/commit`,
      headers: auth(A.accessToken),
      payload: { csv: "name_en,name_kn,name_hi,category\nTest,Test,Test,Cat" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("delivery cannot commit CSV import → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/import/commit`,
      headers: auth(D.accessToken),
      payload: { csv: "name_en,name_kn,name_hi,category\nTest,Test,Test,Cat" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("admin can adjust stock (control)", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const created = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz Stock Test",
        nameKn: "ಆತ್ಜ್ ಸ್ಟಾಕ್ ಟೆಸ್ಟ್",
        nameHi: "ऑथज़ स्टॉक टेस्ट",
        variants: [
          {
            sku: "SKU-AUTHZ-STOCK",
            packSize: 1,
            unit: "kg",
            packLabel: "1 kg",
            mrpPaise: 10000,
            sellingPricePaise: 8500,
            stock: 50,
            lowStockThreshold: 5,
          },
        ],
      },
    });
    const productId = created.json().id;
    const variantId = created.json().variants[0].id;

    // Stock in
    const stockIn = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/adjust`,
      headers: auth(ADMIN.accessToken),
      payload: {
        type: "stock_in",
        variantId,
        quantity: 10,
        note: "Test stock in",
      },
    });
    expect(stockIn.statusCode).toBe(200);
    expect(stockIn.json().delta).toBe(10);
    expect(stockIn.json().newStock).toBe(60);

    // Stock out
    const stockOut = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/adjust`,
      headers: auth(ADMIN.accessToken),
      payload: {
        type: "stock_out",
        variantId,
        quantity: 5,
        reason: "damage",
        note: "Test stock out",
      },
    });
    expect(stockOut.statusCode).toBe(200);
    expect(stockOut.json().delta).toBe(-5);
    expect(stockOut.json().newStock).toBe(55);

    // Correction
    const correction = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/adjust`,
      headers: auth(ADMIN.accessToken),
      payload: {
        type: "correction",
        variantId,
        countedStock: 40,
        note: "Physical count",
      },
    });
    expect(correction.statusCode).toBe(200);
    expect(correction.json().delta).toBe(-15);
    expect(correction.json().newStock).toBe(40);
  });

  it("customer cannot adjust stock → 403", async () => {
    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/adjust`,
      headers: auth(A.accessToken),
      payload: {
        type: "stock_in",
        variantId: "00000000-0000-0000-0000-000000000000",
        quantity: 10,
      },
    });
    expect(res.statusCode).toBe(403);
  });

  it("stock out with insufficient stock → 409 OUT_OF_STOCK", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const created = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz OOS Test",
        nameKn: "ಆತ್ಜ್ ಓಓಎಸ್ ಟೆಸ್ಟ್",
        nameHi: "ऑथज़ ओओएस टेस्ट",
        variants: [
          {
            sku: "SKU-AUTHZ-OOS",
            packSize: 1,
            unit: "piece",
            packLabel: "1 pc",
            mrpPaise: 1000,
            sellingPricePaise: 900,
            stock: 3,
            lowStockThreshold: 5,
          },
        ],
      },
    });
    const variantId = created.json().variants[0].id;

    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/inventory/adjust`,
      headers: auth(ADMIN.accessToken),
      payload: {
        type: "stock_out",
        variantId,
        quantity: 10,
        reason: "damage",
      },
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe("OUT_OF_STOCK");
  });

  it("admin can add a variant (control)", async () => {
    const cats = await app.inject({
      method: "GET",
      url: `${V1}/admin/categories`,
      headers: auth(ADMIN.accessToken),
    });
    const categoryId = cats.json().items[0].id;

    const created = await app.inject({
      method: "POST",
      url: `${V1}/admin/products`,
      headers: auth(ADMIN.accessToken),
      payload: {
        categoryId,
        nameEn: "Authz Variant Test",
        nameKn: "ಆತ್ಜ್ ವೇರಿಯಂಟ್ ಟೆಸ್ಟ್",
        nameHi: "ऑथज़ वेरिएंट टेस्ट",
      },
    });
    expect(created.statusCode).toBe(200);
    const productId = created.json().id;

    const res = await app.inject({
      method: "POST",
      url: `${V1}/admin/products/${productId}/variants`,
      headers: auth(ADMIN.accessToken),
      payload: {
        sku: "SKU-AUTHZ-VAR",
        packSize: 2,
        unit: "kg",
        packLabel: "2 kg",
        mrpPaise: 20000,
        sellingPricePaise: 18000,
        stock: 50,
        lowStockThreshold: 10,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().variants).toHaveLength(1);
    expect(res.json().variants[0].sku).toBe("SKU-AUTHZ-VAR");
  });
});
