import { logger } from "./logger.js";

/**
 * Post-commit side-effect hooks. These run AFTER the DB transaction commits,
 * never inside it (TRD §6.1 rule 3). Real Socket.IO emits + BullMQ push jobs
 * land in Phase 2; for now they are logged so the call sites are already correct.
 */
export const events = {
  orderPlaced(orderId: string, status: string): void {
    logger.info({ orderId, status }, "event: order placed");
  },
  orderStatusChanged(orderId: string, status: string): void {
    logger.info({ orderId, status }, "event: order status changed");
  },
  invoiceRequested(orderId: string): void {
    logger.info({ orderId }, "job: generateInvoice (stub)");
  },
};
