import { logger } from "./logger.js";
import { getIO } from "./socket.js";
import { sendPushNotification } from "./push.js";

/**
 * Post-commit side-effect hooks. These run AFTER the DB transaction commits,
 * never inside it (TRD §6.1 rule 3). Socket.IO emits + push notifications.
 */
export const events = {
  orderPlaced(orderId: string, status: string, userId: string): void {
    logger.info({ orderId, status }, "event: order placed");
    try {
      getIO().to(`order:${orderId}`).emit("order:new", { orderId, status });
      getIO().to(`user:${userId}`).emit("order:new", { orderId, status });
      getIO().to("admin").emit("order:new", { orderId, status });
      // Join the order room so future emits reach the customer
      void getIO().to(`user:${userId}`).socketsJoin(`order:${orderId}`);
    } catch (err) {
      logger.error({ err, orderId }, "Socket.IO emit failed (orderPlaced)");
    }
    // Push to admin (customer is placing the order, doesn't need a push)
    void sendPushNotification("admin", {
      title: "New Order",
      body: `Order ${orderId.slice(0, 8)}… has been placed`,
      data: { type: "order:new", orderId },
    });
  },

  orderStatusChanged(orderId: string, status: string, userId: string): void {
    logger.info({ orderId, status }, "event: order status changed");
    try {
      getIO().to(`order:${orderId}`).emit("order:status_changed", { orderId, status });
      getIO().to(`user:${userId}`).emit("order:status_changed", { orderId, status });
      getIO().to("admin").emit("order:status_changed", { orderId, status });
    } catch (err) {
      logger.error({ err, orderId }, "Socket.IO emit failed (orderStatusChanged)");
    }
    // Push to the order owner
    void sendPushNotification(userId, {
      title: "Order Update",
      body: `Your order status changed to ${status.replace(/_/g, " ")}`,
      data: { type: "order:status_changed", orderId, status },
    });
  },

  invoiceRequested(orderId: string): void {
    logger.info({ orderId }, "job: generateInvoice (stub)");
  },
};
