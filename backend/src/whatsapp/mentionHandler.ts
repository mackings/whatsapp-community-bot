import type { WASocket } from "@whiskeysockets/baileys";
import { listMessages, getGroupFlags } from "../db/messages.repo.js";
import { getCachedGroupMetadata } from "./groupCache.js";
import { getGroupAdmins } from "./admins.js";
import { extractMessageText } from "./extractText.js";
import { isBotMentioned } from "../assistant/mention.js";
import { generateRecap } from "../assistant/recap.js";
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
      if (!(await getGroupFlags(jid))?.respondEnabled) continue;
      if (!isBotMentioned(message, sock)) continue;

      try {
        const { text } = extractMessageText(message);
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
