import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
  type ZodTypeProvider,
} from "fastify-type-provider-zod";
import { RATE_LIMITS } from "@kss/shared";
import { corsOrigins, isProduction } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { redis } from "./lib/redis.js";
import { registerErrorHandler } from "./middleware/errorHandler.js";
import { healthRoutes } from "./routes/health.routes.js";
import { authRoutes } from "./routes/auth.routes.js";
import { meRoutes } from "./routes/me.routes.js";
import { orderRoutes } from "./routes/order.routes.js";
import { inventoryRoutes } from "./routes/inventory.routes.js";
import { productRoutes } from "./routes/product.routes.js";
import { catalogueRoutes } from "./routes/catalogue.routes.js";
import { cartRoutes } from "./routes/cart.routes.js";
import { addressRoutes } from "./routes/address.routes.js";

export async function buildServer() {
  const app = Fastify({
    loggerInstance: logger,
    genReqId: () => crypto.randomUUID(),
    bodyLimit: 1 * 1024 * 1024, // 1 MB default; the voice route raises its own.
    trustProxy: true,
  }).withTypeProvider<ZodTypeProvider>();

  // Zod drives request validation and response serialization.
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  await app.register(helmet, { global: true });
  await app.register(cors, {
    origin: corsOrigins,
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    // The authz test suite makes ~100+ rapid app.inject calls; a higher limit
    // in test avoids spurious 429 failures. Production remains at 100/min.
    max: isProduction ? RATE_LIMITS.globalPerIpPerMinute : 10_000,
    timeWindow: "1 minute",
    redis,
  });

  await app.register(swagger, {
    openapi: {
      info: { title: "KSS API", version: "2.0.0" },
      servers: [{ url: "/api/v1" }],
    },
    transform: jsonSchemaTransform,
  });
  if (!isProduction) {
    await app.register(swaggerUi, { routePrefix: "/docs" });
  }

  registerErrorHandler(app);

  // Ops routes live at the root; the versioned API mounts under /api/v1.
  await app.register(healthRoutes);
  await app.register(
    async (v1) => {
      // Feature routes register here as phases land (catalogue, orders…).
      await v1.register(authRoutes);
      await v1.register(meRoutes);
      await v1.register(orderRoutes);
      await v1.register(inventoryRoutes);
      await v1.register(productRoutes);
      await v1.register(catalogueRoutes);
      await v1.register(cartRoutes);
      await v1.register(addressRoutes);
    },
    { prefix: "/api/v1" },
  );

  return app;
}
