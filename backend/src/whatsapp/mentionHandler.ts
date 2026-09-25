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

        // In a PromptCraft-enabled group, mentioning the bot is always a
        // personal, one-on-one thread — never fall back to the cross-person
        // recap here, since that pulls in *everyone's* recent messages and
        // reads as the bot mashing two different people's pitches together
        // into one reply. If this sender's own history/text doesn't read as
        // (or continue) a pitch, ask them directly instead of guessing.
        if (flags.startupReviewEnabled) {
          const reviewResult = await handleStartupReviewTurn({
            chatJid: jid,
            senderJid,
            senderName: message.pushName ?? "Unknown",
            text: effectiveText,
          });

          const reply =
            reviewResult?.reply ?? "Tell me about your startup — what problem it solves and who it's for.";
          await sock.sendMessage(jid, { text: reply }, { quoted: message });
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
