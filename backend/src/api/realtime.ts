import { WebSocketServer } from "ws";
import type { Server as HttpServer } from "node:http";
import type { StoredMessage } from "../types/index.js";
import { logger } from "../whatsapp/logger.js";

type ConnectionStatus = "connecting" | "open" | "closed";

export interface Broadcaster {
  broadcastMessage: (message: StoredMessage) => void;
  broadcastStatus: (status: ConnectionStatus) => void;
  broadcastQr: (dataUrl: string | null) => void;
}

/**
 * Attaches the WebSocket server to the same HTTP server/port as the REST
 * API (upgrading on /ws) instead of listening on a separate port — most
 * hosts (Render, Fly, etc.) only expose one public port per service.
 */
export function attachRealtimeServer(httpServer: HttpServer): Broadcaster {
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  // last known state, so a browser tab opened after the QR/status was
  // broadcast still sees it immediately instead of waiting for the next event
  let lastStatus: ConnectionStatus = "connecting";
  let lastQr: string | null = null;

  logger.info("WebSocket server attached at /ws");
  wss.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "status", payload: lastStatus }));
    if (lastQr) socket.send(JSON.stringify({ type: "qr", payload: lastQr }));
  });

  function send(payload: unknown) {
    const data = JSON.stringify(payload);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) client.send(data);
    }
  }

  return {
    broadcastMessage: (message) => send({ type: "message", payload: message }),
    broadcastStatus: (status) => {
      lastStatus = status;
      send({ type: "status", payload: status });
    },
    broadcastQr: (dataUrl) => {
      lastQr = dataUrl;
      send({ type: "qr", payload: dataUrl });
    },
  };
}
