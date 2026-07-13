import { Expo, type ExpoPushMessage } from "expo-server-sdk";
import { env, isProduction } from "../config/env.js";
import { logger } from "./logger.js";
import { prisma } from "./prisma.js";

/**
 * Expo push notification service (T2.6). Sends push notifications to device
 * tokens stored in the `device_tokens` table.
 *
 * In dev mode, logs the notification without sending.
 */
const expo = new Expo({ accessToken: env.EXPO_ACCESS_TOKEN });

type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

/**
 * Send a push notification to a user (by userId) or to all admin users.
 * Silently skips users without Expo push tokens.
 */
export async function sendPushNotification(
  target: "admin" | string, // "admin" or userId
  payload: PushPayload,
): Promise<void> {
  try {
    let tokens: string[];

    if (target === "admin") {
      const rows = await prisma.deviceToken.findMany({
        where: { user: { role: "admin" } },
        select: { token: true },
      });
      tokens = rows.map((r) => r.token);
    } else {
      const rows = await prisma.deviceToken.findMany({
        where: { userId: target },
        select: { token: true },
      });
      tokens = rows.map((r) => r.token);
    }

    if (tokens.length === 0) return;

    // Filter to valid Expo push tokens
    const validTokens = tokens.filter((t) => Expo.isExpoPushToken(t));
    if (validTokens.length === 0) return;

    if (!isProduction) {
      logger.info(
        { target, tokens: validTokens.length, payload },
        "[dev] push notification",
      );
      return;
    }

    const messages: ExpoPushMessage[] = validTokens.map((token) => ({
      to: token,
      sound: "default" as const,
      title: payload.title,
      body: payload.body,
      data: (payload.data ?? {}) as Record<string, unknown>,
      priority: "high" as const,
    }));

    // Send in chunks of 100 (Expo API limit)
    const chunks = expo.chunkPushNotifications(messages);
    for (const chunk of chunks) {
      try {
        const receipts = await expo.sendPushNotificationsAsync(chunk);
        logger.info({ receipts }, "push notifications sent");
      } catch (err) {
        logger.error({ err }, "push notification send failed");
      }
    }
  } catch (err) {
    logger.error({ err, target }, "push notification error");
  }
}
