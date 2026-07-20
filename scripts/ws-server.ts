// Entry point for the standalone WebSocket server process (see
// docker-compose.yml's `ws` service / `npm run ws`).
try {
  process.loadEnvFile(".env");
} catch {
  // No .env file (e.g. production — real env vars are injected directly).
}

import { createWsServer } from "@/server/websocket";
import { createChildLogger } from "@/server/logger";
import { env } from "@/server/config/env";

const logger = createChildLogger({ module: "ws-entrypoint" });

const server = createWsServer(env.WS_PORT);

const shutdown = async (signal: string) => {
  logger.info({ signal }, "ws server shutting down");
  await server.close();
  process.exit(0);
};
process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
