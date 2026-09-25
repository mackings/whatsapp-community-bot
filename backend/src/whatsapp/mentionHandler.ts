import type { WASocket } from "@whiskeysockets/baileys";
import { listMessages, getGroupFlags, getMessageById } from "../db/messages.repo.js";
import { getCachedGroupMetadata } from "./groupCache.js";
import { getGroupAdmins } from "./admins.js";
import { extractMessageText } from "./extractText.js";
import { isBotMentioned } from "../assistant/mention.js";
import { generateRecap } from "../assistant/recap.js";
import { handleStartupReviewTurn } from "./startupReviewEngine.js";
import { logger } from "./logger.js";

const GROUP_SUFFIX = "@g.us";
// Whatever the bot has stored since joining this group — questions like
// "what's the course link" or "when's the deadline" often reference things
// announced days earlier, not just the last 24h, so this isn't time-boxed.
const HISTORY_LIMIT = 1000;

/**
 * Listens for the bot being @-mentioned in a group and replies with a
 * Claude-generated recap of recent activity, grounded in this group's own
 * stored message history (see assistant/recap.ts).
 */
export function registerMentionHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      const jid = message.key.remoteJid;
      if (!jid || !jid.endsWith(GROUP_SUFFIX)) continue;
      if (!message.message || message.key.fromMe) continue;
      const flags = await getGroupFlags(jid);
      if (!flags?.respondEnabled) continue;
      if (!isBotMentioned(message, sock)) continue;

      try {
        const { text } = extractMessageText(message);
        const senderJid = message.key.participant ?? jid;

        // A tag often reads "@bot" on its own, replying to an earlier
        // message that actually has the content (e.g. someone pitches their
        // startup, then replies to their own message with just the mention
        // to get the bot's attention) — pull the quoted text in so pitch
        // detection sees the real content, not just the bare tag.
        const contextInfo = message.message.extendedTextMessage?.contextInfo;
        const quotedId = contextInfo?.stanzaId;
        const quotedMessage = contextInfo?.quotedMessage;
        let effectiveText = text;
        if (quotedId && quotedMessage) {
          const stored = await getMessageById(quotedId);
          const quotedText =
            stored?.text || quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || "";
          if (quotedText) effectiveText = `${quotedText}\n${text}`.trim();
        }

        // PromptCraft's startup review takes priority over the generic recap
        // when this mention is (or continues) a pitch — a founder shouldn't
        // get both a recap AND a review reply for the same message. Gated
        // per-group separately from respondEnabled so it can be piloted in
        // one test group without changing recap/auto-answer elsewhere.
        const reviewResult = flags.startupReviewEnabled
          ? await handleStartupReviewTurn({
              chatJid: jid,
              senderJid,
              senderName: message.pushName ?? "Unknown",
              text: effectiveText,
            })
          : null;
        if (reviewResult) {
          await sock.sendMessage(jid, { text: reviewResult.reply }, { quoted: message });
          continue;
        }

        const groupMetadata = getCachedGroupMetadata(jid);
        const history = await listMessages({ groupJid: jid, limit: HISTORY_LIMIT });

        await sock.sendPresenceUpdate("composing", jid);
        const reply = await generateRecap({
          groupName: groupMetadata?.subject ?? jid,
          question: text,
          history,
          admins: await getGroupAdmins(jid),
        });

        if (reply) {
          await sock.sendMessage(jid, { text: reply.text, mentions: reply.mentions }, { quoted: message });
        }
      } catch (error) {
        logger.error({ error }, "failed to respond to mention");
      }
    }
  });
}
