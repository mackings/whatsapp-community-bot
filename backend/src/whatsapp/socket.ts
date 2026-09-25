import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import type { ConnectionState, WASocket } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
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

const VERSION_FETCH_TIMEOUT_MS = 5_000;

// fetchLatestBaileysVersion() hits a GitHub raw URL with no timeout of its
// own — if that network call ever hangs (as it did once in production), it
// silently blocks the whole connection forever before a socket is even
// created. Race it against a timeout and fall back to Baileys' own bundled
// default version (same one it ships if you never call this at all).
async function fetchVersionWithTimeout(): Promise<[number, number, number] | undefined> {
  try {
    const { version } = await Promise.race([
      fetchLatestBaileysVersion(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("fetchLatestBaileysVersion timed out")), VERSION_FETCH_TIMEOUT_MS)
      ),
    ]);
    return version;
  } catch {
    return undefined;
  }
}

export async function startWhatsAppConnection(options: StartOptions = {}): Promise<WASocket> {
  const { state, saveCreds } = await useMongoDBAuthState();
  const version = await fetchVersionWithTimeout();

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
      logger.error({ err: error }, "unhandled error in connection.update — connection kept alive");
    }
  });

  async function handleConnectionUpdate(update: Partial<ConnectionState>) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && !env.pairingNumber) {
      options.onQrCode?.(await QRCode.toDataURL(qr, { margin: 1, scale: 6 }));
    }

    if (connection === "open") {
      logger.info("WhatsApp connection open");
      options.onQrCode?.(null);
      // Register handlers and report "open" before touching the group
      // cache — fetching metadata for every group is heavy (hundreds of
      // groups) and can time out or throw. It used to run first and,
      // unguarded, a failure there silently skipped onSocketReady entirely:
      // the bot would sit there reporting "connected" while no message
      // handler was ever attached and nothing it received got processed.
      options.onSocketReady?.(sock);
      options.onStatusChange?.("open");
      try {
        await primeGroupCache(sock)();
      } catch (error) {
        logger.error({ err: error }, "failed to prime group cache — group list may be stale until next sync");
      }
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
            logger.error({ err: error }, "reconnect attempt failed")
          );
        }, 2000);
      } else {
        logger.error("logged out from WhatsApp — clearing session and starting a fresh link");
        await clearAuthState();
        startWhatsAppConnection(options).catch((error) =>
          logger.error({ err: error }, "restart after logout failed")
        );
      }
    }
  }

  return sock;
}
