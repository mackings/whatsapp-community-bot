import express from "express";
import cors from "cors";
import { createServer } from "node:http";
import { messagesRouter } from "./routes/messages.js";
import { groupsRouter } from "./routes/groups.js";
import { statsRouter } from "./routes/stats.js";
import { pushRouter } from "./routes/push.js";
import { authRouter } from "./routes/auth.js";
import { attachRealtimeServer, type Broadcaster } from "./realtime.js";
import { logApiCalls, apiLogger } from "./requestLogger.js";
import { env } from "../config/env.js";

export function startApiServer(getConnectionStatus: () => string): Broadcaster {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(logApiCalls);

  // Render (and anyone poking the bare URL) hits "/" for health checks —
  // answer it directly so that doesn't show up as a stream of fake failures.
  app.get("/", (_req, res) => {
    res.json({ ok: true, connection: getConnectionStatus() });
  });

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, connection: getConnectionStatus() });
  });

  app.use("/api/messages", messagesRouter);
  app.use("/api/groups", groupsRouter);
  app.use("/api/stats", statsRouter);
  app.use("/api/push", pushRouter);
  app.use("/api/auth", authRouter);
  app.use("/media", express.static(env.mediaDir));

  const httpServer = createServer(app);
  const broadcaster = attachRealtimeServer(httpServer);

  httpServer.listen(env.port, () => {
    apiLogger.info(`API server (+ WebSocket at /ws) listening on :${env.port}`);
  });

  return broadcaster;
}
