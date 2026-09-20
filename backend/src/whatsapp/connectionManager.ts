import { rmSync } from "node:fs";
import type { WASocket } from "@whiskeysockets/baileys";
import { startWhatsAppConnection, type StartOptions } from "./socket.js";
import { getActiveSocket } from "./activeSocket.js";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

let currentOptions: StartOptions = {};

/** Entry point index.ts calls once — remembers the callbacks so logoutAndRelink can reuse them. */
export function initConnection(options: StartOptions): Promise<WASocket> {
  currentOptions = options;
  return startWhatsAppConnection(options);
}

/**
 * Manually unlinks the current WhatsApp account. sock.logout() triggers a
 * "close" event with DisconnectReason.loggedOut, which socket.ts's own
 * handler already clears the session and restarts on — so on the success
 * path we deliberately don't restart here too, to avoid racing two
 * concurrent connections. Only the fallback (no socket, or logout() itself
 * failing) restarts directly.
 */
export async function logoutAndRelink(): Promise<void> {
  const sock = getActiveSocket();

  if (sock) {
    try {
      await sock.logout();
      return;
    } catch (error) {
      logger.warn({ error }, "logout request to WhatsApp failed — clearing session and restarting directly");
    }
  }

  rmSync(env.authDir, { recursive: true, force: true });
  await startWhatsAppConnection(currentOptions);
}
