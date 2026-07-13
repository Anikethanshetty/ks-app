import { Queue, Worker } from "bullmq";
import { redis } from "./redis.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";
import { events } from "./events.js";

/**
 * BullMQ queue + worker for background jobs (T3.5 expireUnpaidOrders and
 * future Phase 4 invoice generation, Phase 5 voice transcription, etc.).
 *
 * Shared Redis connection (already configured with maxRetriesPerRequest: null
 * in redis.ts) handles both the job queue and the repeatable schedule.
 */

const QUEUE_NAME = "kss";

let queue: Queue | null = null;
let worker: Worker | null = null;

/** Get the queue (throws if not initialised — guards against startup races). */
export function getQueue(): Queue {
  if (!queue) throw new Error("BullMQ queue not initialised.");
  return queue;
}

/**
 * Initialise the BullMQ queue + worker + repeatable job schedule.
 * Safe to call multiple times (idempotent).
 */
export async function initQueue(): Promise<void> {
  if (queue) return;

  queue = new Queue(QUEUE_NAME, {
    connection: redis as unknown as any,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 10_000 },
    },
  });

  worker = new Worker(
    QUEUE_NAME,
    async (job) => {
      switch (job.name) {
        case "expireUnpaidOrders":
          await expireUnpaidOrders();
          break;
        default:
          logger.warn({ jobName: job.name }, "Unknown job received");
      }
    },
    {
      connection: redis as unknown as any,
      // Process one job at a time so we don't overload the DB.
      concurrency: 1,
    },
  );

  worker.on("failed", (job, err) => {
    logger.error({ jobName: job?.name, err }, "BullMQ job failed");
  });

  // Register a repeatable job: runs every 5 minutes.
  await queue.upsertJobScheduler(
    "expireUnpaidOrders-scheduler",
    { every: 5 * 60 * 1000 },
    { name: "expireUnpaidOrders" },
  );

  logger.info("BullMQ queue + worker initialised (repeatable job: every 5 min)");
}

/** Graceful shutdown: close worker then queue. */
export async function closeQueue(): Promise<void> {
  await worker?.close();
  await queue?.close();
  worker = null;
  queue = null;
  logger.info("BullMQ queue + worker closed");
}

// ── Job handlers ──────────────────────────────────────────────────────────

/**
 * Find orders stuck in `payment_pending_verification` for >60 minutes and
 * auto-cancel them, restoring stock. Runs every 5 minutes via the repeatable
 * scheduler above (T3.5).
 */
async function expireUnpaidOrders(): Promise<void> {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  logger.info({ cutoff: cutoff.toISOString() }, "expireUnpaidOrders: checking for expired orders");

  // Find expired unpaid orders — only auto-cancel orders where the customer
  // has NOT yet submitted a payment. If a payment was submitted (even if still
  // pending admin verification), don't touch it.
  const expired = await prisma.order.findMany({
    where: {
      status: "payment_pending_verification",
      placedAt: { lt: cutoff },
      payments: { none: { status: "pending_verification" } },
    },
    include: {
      items: true,
    },
  });

  if (expired.length === 0) {
    logger.info("expireUnpaidOrders: no expired orders found");
    return;
  }

  logger.info({ count: expired.length }, `expireUnpaidOrders: cancelling ${expired.length} order(s)`);

  let cancelled = 0;
  for (const order of expired) {
    try {
      await prisma.$transaction(
        async (tx) => {
          // Create status event
          await tx.orderStatusEvent.create({
            data: {
              orderId: order.id,
              status: "cancelled",
              note: "Auto-cancelled: payment not received within 60 minutes",
            },
          });

          // Update order status
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: "cancelled",
              cancelledAt: new Date(),
              cancelReason: "Payment not received within 60 minutes",
            },
          });

          // Restore stock for each item + write inventory movement
          for (const it of order.items) {
            await tx.productVariant.update({
              where: { id: it.variantId },
              data: { stock: { increment: it.quantity } },
            });
            await tx.inventoryMovement.create({
              data: {
                variantId: it.variantId,
                delta: it.quantity,
                reason: "return",
                orderId: order.id,
              },
            });
          }
        },
        { isolationLevel: "ReadCommitted", timeout: 10_000 },
      );

      // Post-commit side effects (Socket.IO + push)
      events.orderStatusChanged(order.id, "cancelled", order.userId);
      cancelled++;
    } catch (err) {
      logger.error({ err, orderId: order.id }, "expireUnpaidOrders: failed to cancel order");
    }
  }

  logger.info({ cancelled, total: expired.length }, "expireUnpaidOrders: completed");
}
