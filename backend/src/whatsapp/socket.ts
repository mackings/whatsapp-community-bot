import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import type { ConnectionState, WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerminal from "qrcode-terminal";
import QRCode from "qrcode";
import { env } from "../config/env.js";
import { logger } from "./logger.js";
import { getCachedGroupMetadata, primeGroupCache, watchGroupUpdates } from "./groupCache.js";
import { useMongoDBAuthState, clearAuthState } from "./mongoAuthState.js";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface StartOptions {
  onStatusChange?: (status: ConnectionStatus) => void;
  onSocketReady?: (sock: WASocket) => void;
  onQrCode?: (dataUrl: string | null) => void;
}

export async function startWhatsAppConnection(options: StartOptions = {}): Promise<WASocket> {
  const { state, saveCreds } = await useMongoDBAuthState();
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    logger,
    browser: Browsers.macOS("Community Bot"),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    cachedGroupMetadata: async (jid) => getCachedGroupMetadata(jid),
    markOnlineOnConnect: false,
  });

  watchGroupUpdates(sock);

  // Must be registered before requestPairingCode below — it assigns
  // creds.pairingCode and emits creds.update immediately, and that write
  // has to actually hit disk or every reconnect looks like a fresh attempt.
  sock.ev.on("creds.update", saveCreds);

  // WhatsApp closes the raw connection right after issuing a pairing code —
  // that's expected. Only request one on the very first attempt (no code
  // persisted yet); reconnects should just wait for the phone to confirm it,
  // never request a fresh one (each new code invalidates the last).
  if (env.pairingNumber && !state.creds.registered && !state.creds.pairingCode) {
    await sock.waitForSocketOpen();
    const code = await sock.requestPairingCode(env.pairingNumber);
    logger.info(`Pairing code for ${env.pairingNumber}: ${code}`);
    logger.info("Enter this code on your phone within ~60s: WhatsApp > Linked Devices > Link with phone number");
  }

  sock.ev.on("connection.update", async (update) => {
    try {
      await handleConnectionUpdate(update);
    } catch (error) {
      logger.error({ error }, "unhandled error in connection.update — connection kept alive");
    }
  });

  async function handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !env.pairingNumber) {
      qrcodeTerminal.generate(qr, { small: true }); // fallback for headless/terminal use
      options.onQrCode?.(await QRCode.toDataURL(qr, { margin: 1, scale: 6 }));
    }

    if (connection === "open") {
      logger.info("WhatsApp connection open");
      options.onStatusChange?.("open");
      options.onQrCode?.(null);
      await primeGroupCache(sock)();
      options.onSocketReady?.(sock);
    } else if (connection === "connecting") {
      options.onStatusChange?.("connecting");
    } else if (connection === "close") {
      options.onStatusChange?.("closed");
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      logger.warn({ statusCode, shouldReconnect }, "connection closed");

      if (shouldReconnect) {
        // small backoff so a flapping connection doesn't hot-loop reconnects
        setTimeout(() => {
          startWhatsAppConnection(options).catch((error) =>
            logger.error({ error }, "reconnect attempt failed")
          );
        }, 2000);
      } else {
        logger.error("logged out from WhatsApp — clearing session and starting a fresh link");
        await clearAuthState();
        startWhatsAppConnection(options).catch((error) =>
          logger.error({ error }, "restart after logout failed")
        );
      }
    }
  }

  return sock;
}
