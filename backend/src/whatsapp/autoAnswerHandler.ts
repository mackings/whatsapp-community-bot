import type { WASocket } from "@whiskeysockets/baileys";
import { listMessages, getGroupFlags } from "../db/messages.repo.js";
import { getCachedGroupMetadata } from "./groupCache.js";
import { getGroupAdmins } from "./admins.js";
import { extractMessageText } from "./extractText.js";
import { isBotMentioned } from "../assistant/mention.js";
import { evaluateAutoAnswer } from "../assistant/autoAnswer.js";
import { logger } from "./logger.js";

const GROUP_SUFFIX = "@g.us";
const HISTORY_LIMIT = 1000;

function looksLikeQuestion(text: string): boolean {
  return /\?\s*$/.test(text.trim());
}

/**
 * Watches group chat for plain questions (no @-mention) and quietly answers
 * only when confident the group's own history actually covers it — see
 * assistant/autoAnswer.ts for the "stay silent unless sure" guardrail.
 * Mention-triggered replies are handled separately by mentionHandler.ts.
 */
export function registerAutoAnswerHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      const jid = message.key.remoteJid;
      if (!jid || !jid.endsWith(GROUP_SUFFIX)) continue;
      if (!message.message || message.key.fromMe) continue;
      if (!(await getGroupFlags(jid))?.respondEnabled) continue;
      if (isBotMentioned(message, sock)) continue; // mentionHandler already covers this

      try {
        const { text } = extractMessageText(message);
        if (!text || !looksLikeQuestion(text)) continue;

        const groupMetadata = getCachedGroupMetadata(jid);
        const history = await listMessages({ groupJid: jid, limit: HISTORY_LIMIT });

        const answer = await evaluateAutoAnswer({
          groupName: groupMetadata?.subject ?? jid,
          question: text,
          history,
          admins: await getGroupAdmins(jid),
        });

        if (answer) {
          await sock.sendMessage(jid, { text: answer.text, mentions: answer.mentions }, { quoted: message });
        }
      } catch (error) {
        logger.error({ error }, "failed to auto-answer question");
      }
    }
  });
}
