import type { WASocket } from "@whiskeysockets/baileys";
import { extractMessageText } from "./extractText.js";
import { handleStartupReviewTurn } from "./startupReviewEngine.js";
import { logger } from "./logger.js";

const GROUP_SUFFIX = "@g.us";
const BROADCAST_SUFFIX = "@broadcast";

/**
 * DMs to the bot are always eligible for PromptCraft's startup review —
 * every message is implicitly "to the bot" in a private chat, so unlike
 * groups this needs no @mention to start or continue an interview.
 */
export function registerStartupReviewHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      const jid = message.key.remoteJid;
      if (!jid || jid.endsWith(GROUP_SUFFIX) || jid.endsWith(BROADCAST_SUFFIX)) continue;
      if (!message.message || message.key.fromMe) continue;

      try {
        const { text } = extractMessageText(message);
        const result = await handleStartupReviewTurn({
          chatJid: jid,
          senderJid: jid,
          senderName: message.pushName ?? "Unknown",
          text,
        });

        if (result) {
          await sock.sendMessage(jid, { text: result.reply });
        }
      } catch (error) {
        logger.error({ error }, "failed to process startup review DM");
      }
    }
  });
}
