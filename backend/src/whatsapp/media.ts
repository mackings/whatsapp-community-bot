import { downloadMediaMessage, type WAMessage, type WASocket } from "@whiskeysockets/baileys";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { env } from "../config/env.js";
import { logger } from "./logger.js";

const DOWNLOADABLE_TYPES = new Set([
  "imageMessage",
  "videoMessage",
  "audioMessage",
  "documentMessage",
  "stickerMessage",
]);

mkdirSync(env.mediaDir, { recursive: true });

function getMimetype(message: WAMessage, messageType: string): string | undefined {
  const content = message.message;
  if (!content) return undefined;

  switch (messageType) {
    case "imageMessage":
      return content.imageMessage?.mimetype ?? undefined;
    case "videoMessage":
      return content.videoMessage?.mimetype ?? undefined;
    case "audioMessage":
      return content.audioMessage?.mimetype ?? undefined;
    case "documentMessage":
      return content.documentMessage?.mimetype ?? undefined;
    case "stickerMessage":
      return content.stickerMessage?.mimetype ?? undefined;
    default:
      return undefined;
  }
}

function extensionFor(mimetype: string | undefined): string {
  const subtype = mimetype?.split(";")[0].split("/")[1];
  if (!subtype) return "bin";
  if (subtype === "jpeg") return "jpg";
  return subtype.replace(/[^a-z0-9]/gi, "") || "bin";
}

/**
 * Downloads a media message's content to disk and returns a public path
 * (served statically by the API under /media) or null if there's nothing
 * to download / the download fails.
 */
export async function downloadAndStoreMedia(
  message: WAMessage,
  messageType: string,
  sock: WASocket
): Promise<string | null> {
  if (!DOWNLOADABLE_TYPES.has(messageType)) return null;

  try {
    const buffer = (await downloadMediaMessage(
      message,
      "buffer",
      {},
      { logger, reuploadRequest: sock.updateMediaMessage }
    )) as Buffer;

    const filename = `${message.key.id ?? Date.now()}.${extensionFor(getMimetype(message, messageType))}`;
    writeFileSync(join(env.mediaDir, filename), buffer);

    return `/media/${filename}`;
  } catch (error) {
    logger.error({ error }, "failed to download media message");
    return null;
  }
}
