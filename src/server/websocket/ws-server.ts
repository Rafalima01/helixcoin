import { createServer, type IncomingMessage } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import IORedis from "ioredis";
import { env } from "@/server/config/env";
import { createChildLogger } from "@/server/logger";
import { verifyAccessToken } from "@/server/auth/jwt";
import type { AccessTokenClaims } from "@/server/auth/jwt";

const logger = createChildLogger({ module: "ws-server" });

interface ClientMeta {
  id: string;
  rooms: Set<string>;
  auth?: AccessTokenClaims;
}

interface WsBroadcastMessage {
  room: string;
  event: string;
  payload: unknown;
}

const REDIS_CHANNEL = "ws:broadcast";

export interface WsServerHandle {
  wss: WebSocketServer;
  /** Publishes to Redis so every server replica (including this one) relays it to its local room members. */
  broadcast: (room: string, event: string, payload: unknown) => Promise<void>;
  joinRoom: (socket: WebSocket, room: string) => void;
  leaveRoom: (socket: WebSocket, room: string) => void;
  close: () => Promise<void>;
}

/**
 * Standalone WebSocket server (run via scripts/ws-server.ts, containerized
 * as the `ws` service in docker-compose.yml — Next.js Route Handlers can't
 * hold a persistent Upgrade connection without a custom server, so this
 * lives outside the Next process entirely).
 *
 * Broadcasts go through Redis pub/sub rather than direct local delivery so
 * this scales horizontally: a client connected to replica A still receives
 * a broadcast published from replica B.
 *
 * No message protocol is implemented yet ("nada implementado" per the
 * infra brief) — `connection`'s `message` handler is the extension point a
 * real module wires a protocol into.
 */
export function createWsServer(port: number = env.WS_PORT): WsServerHandle {
  const httpServer = createServer();
  const wss = new WebSocketServer({ server: httpServer });

  const clients = new Map<WebSocket, ClientMeta>();
  const rooms = new Map<string, Set<WebSocket>>();

  const pub = new IORedis(env.REDIS_URL, { lazyConnect: true });
  const sub = new IORedis(env.REDIS_URL, { lazyConnect: true });

  sub
    .subscribe(REDIS_CHANNEL)
    .catch((err) => logger.error({ err }, "Failed to subscribe to ws broadcast channel"));

  sub.on("message", (_channel, raw) => {
    try {
      const msg = JSON.parse(raw) as WsBroadcastMessage;
      broadcastLocal(msg.room, msg.event, msg.payload);
    } catch (err) {
      logger.error({ err }, "Failed to parse relayed ws broadcast message");
    }
  });

  function broadcastLocal(room: string, event: string, payload: unknown) {
    const sockets = rooms.get(room);
    if (!sockets || sockets.size === 0) return;
    const message = JSON.stringify({ event, payload });
    for (const socket of sockets) {
      if (socket.readyState === socket.OPEN) socket.send(message);
    }
  }

  async function broadcast(room: string, event: string, payload: unknown): Promise<void> {
    const message: WsBroadcastMessage = { room, event, payload };
    await pub.publish(REDIS_CHANNEL, JSON.stringify(message));
  }

  function joinRoom(socket: WebSocket, room: string): void {
    clients.get(socket)?.rooms.add(room);
    if (!rooms.has(room)) rooms.set(room, new Set());
    rooms.get(room)!.add(socket);
  }

  function leaveRoom(socket: WebSocket, room: string): void {
    clients.get(socket)?.rooms.delete(room);
    rooms.get(room)?.delete(socket);
  }

  wss.on("connection", (socket, req) => {
    const meta: ClientMeta = { id: crypto.randomUUID(), rooms: new Set() };
    clients.set(socket, meta);
    logger.info({ clientId: meta.id, url: req.url }, "client connected");

    socket.on("message", (raw) => {
      logger.debug(
        { clientId: meta.id, raw: raw.toString() },
        "message received (no protocol wired yet)"
      );
    });

    socket.on("close", () => {
      for (const room of meta.rooms) rooms.get(room)?.delete(socket);
      clients.delete(socket);
      logger.info({ clientId: meta.id }, "client disconnected");
    });

    socket.on("error", (err) => logger.error({ clientId: meta.id, err }, "socket error"));
  });

  httpServer.listen(port, () => logger.info({ port }, "WebSocket server listening"));

  return {
    wss,
    broadcast,
    joinRoom,
    leaveRoom,
    close: async () => {
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
      sub.disconnect();
      pub.disconnect();
    },
  };
}

/**
 * Optional auth extraction for a connecting client (`?token=<jwt>` on the
 * upgrade URL) — not enforced by `createWsServer` itself, since whether a
 * given room/event requires auth is a per-module decision. Call this inside
 * a `connection` handler once a real module needs it.
 */
export async function authenticateWsRequest(
  req: IncomingMessage
): Promise<AccessTokenClaims | null> {
  const url = new URL(req.url ?? "", "http://internal");
  const token = url.searchParams.get("token");
  if (!token) return null;
  try {
    return await verifyAccessToken(token);
  } catch {
    return null;
  }
}
