import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import type { FastifyInstance } from "fastify";
import { createHmac, timingSafeEqual } from "node:crypto";
import { redis } from "./redis.js";
import { env, isProduction } from "../config/env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

/**
 * Socket.IO gateway (TRD §7). Attached to the Fastify server's underlying HTTP
 * server so a single port serves both REST and WebSocket.
 *
 * Server-decided rooms:
 *   user:{userId}  — personal room (customer, delivery, admin)
 *   admin          — all admin users
 *   order:{orderId} — order-specific events
 */

let io: SocketIOServer | null = null;

/**
 * Verify a Bearer‑style JWT and return the payload, or null.
 * We manually verify to avoid a Fastify‑specific dependency here; the only
 * required property is that the token was signed with JWT_ACCESS_SECRET.
 */
function verifySocketToken(token: string): { sub: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [header, payload, signature] = parts;
    const expected = createHmac("sha256", env.JWT_ACCESS_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    // Constant‑time compare — token verification should never leak timing.
    const sigBuf = Buffer.from(signature!);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length) return null;
    if (!timingSafeEqual(sigBuf, expBuf)) return null;

    const data = JSON.parse(Buffer.from(payload!, "base64url").toString());
    const now = Math.floor(Date.now() / 1000);
    if (data.exp && data.exp < now) return null; // expired
    return { sub: data.sub, role: data.role ?? "customer" };
  } catch {
    return null;
  }
}

/** Initialise the Socket.IO server, attach it to Fastify's http server. */
export function initSocketIO(app: FastifyInstance): SocketIOServer {
  if (io) return io;

  io = new SocketIOServer(app.server, {
    cors: {
      origin: env.CORS_ORIGINS.split(",").map((s) => s.trim()),
      credentials: true,
    },
    // In production we may want ping-based keepalive; 25 s ping → 30 s disconnect
    pingInterval: 25_000,
    pingTimeout: 30_000,
  });

  // Redis adapter for multi‑instance horizontal scaling.
  const pub = redis.duplicate();
  const sub = redis.duplicate();
  io.adapter(createAdapter(pub, sub));

  // ── Authentication middleware ──
  io.use((socket, next) => {
    const token =
      socket.handshake.auth?.token ??
      socket.handshake.query?.token as string | undefined;
    if (!token) return next(new Error("UNAUTHENTICATED"));
    const payload = verifySocketToken(token);
    if (!payload) return next(new Error("TOKEN_INVALID"));
    // Attach user info to the socket so handlers can read it
    (socket as any).user = payload;
    next();
  });

  // ── Connection handler ──
  io.on("connection", async (socket) => {
    const user = (socket as any).user as { sub: string; role: string; };
    logger.info({ userId: user.sub, role: user.role, id: socket.id }, "socket connected");

    // Join server‑decided rooms
    socket.join(`user:${user.sub}`);
    if (user.role === "admin") socket.join("admin");
    // Delivery users could optionally join a `delivery` room for broadcast events

    socket.on("disconnect", (reason) => {
      logger.info({ userId: user.sub, id: socket.id, reason }, "socket disconnected");
    });
  });

  logger.info("Socket.IO gateway initialised");
  return io;
}

export function getIO(): SocketIOServer {
  if (!io) throw new Error("Socket.IO not initialised. Call initSocketIO() first.");
  return io;
}

export async function closeSocketIO(): Promise<void> {
  if (!io) return;
  await io.close();
  io = null;
  logger.info("Socket.IO gateway closed");
}
