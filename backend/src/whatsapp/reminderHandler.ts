import type { WASocket } from "@whiskeysockets/baileys";
import { isBotMentioned } from "../assistant/mention.js";
import { extractReminderRequest } from "../assistant/reminderExtraction.js";
import { extractMessageText } from "./extractText.js";
import { getMessageById, getGroupFlags } from "../db/messages.repo.js";
import { createReminder } from "../db/reminders.repo.js";
import { getCachedGroupMetadata } from "./groupCache.js";
import { logger } from "./logger.js";

const GROUP_SUFFIX = "@g.us";
const DEFAULT_LEAD_MINUTES = 15;
const MIN_SCHEDULE_DELAY_MS = 5_000;

/**
 * Listens for someone replying to a message (tagging the bot) asking to be
 * reminded about whatever that message describes — resolves the event time
 * via Gemini, then schedules a private reminder DM (see reminderScheduler.ts).
 */
export function registerReminderHandler(sock: WASocket): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      const jid = message.key.remoteJid;
      if (!jid || !jid.endsWith(GROUP_SUFFIX)) continue;
      if (!message.message || message.key.fromMe) continue;
      if (!getGroupFlags(jid)?.respondEnabled) continue;
      if (!isBotMentioned(message, sock)) continue;

      const contextInfo = message.message.extendedTextMessage?.contextInfo;
      const quotedMessage = contextInfo?.quotedMessage;
      const quotedId = contextInfo?.stanzaId;
      if (!quotedMessage || !quotedId) continue; // only relevant when replying to something

      try {
        const { text: replyText } = extractMessageText(message);
        const stored = getMessageById(quotedId);
        const quotedText =
          stored?.text || quotedMessage.conversation || quotedMessage.extendedTextMessage?.text || "";
        if (!quotedText) continue;

        const quotedTimestamp =
          stored?.timestamp ?? Number(message.messageTimestamp ?? Date.now() / 1000) * 1000;

        const extraction = await extractReminderRequest({
          quotedText,
          quotedTimestamp,
          replyText,
          now: Date.now(),
        });

        if (!extraction?.remind || !extraction.eventTimeISO) continue;

        const eventTime = new Date(extraction.eventTimeISO).getTime();
        if (Number.isNaN(eventTime) || eventTime <= Date.now()) continue;

        const leadMinutes =
          extraction.leadMinutes && extraction.leadMinutes > 0 ? extraction.leadMinutes : DEFAULT_LEAD_MINUTES;
        const remindAt = Math.max(eventTime - leadMinutes * 60_000, Date.now() + MIN_SCHEDULE_DELAY_MS);
        const groupMetadata = getCachedGroupMetadata(jid);
        const eventDescription = extraction.event ?? quotedText;

        createReminder({
          groupJid: jid,
          groupName: groupMetadata?.subject ?? jid,
          userJid: message.key.participant ?? jid,
          eventDescription,
          eventTime,
          remindAt,
        });

        const when = remindAt <= Date.now() + MIN_SCHEDULE_DELAY_MS ? "shortly" : `around ${new Date(remindAt).toLocaleTimeString()}`;
        await sock.sendMessage(
          jid,
          { text: `Got it, I'll DM you a reminder ${when} for: ${eventDescription}` },
          { quoted: message }
        );
      } catch (error) {
        logger.error({ error }, "failed to process reminder request");
      }
    }
  });
}
