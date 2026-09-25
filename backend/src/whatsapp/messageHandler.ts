import type { WASocket } from "@whiskeysockets/baileys";
import type { Categorizer, StoredMessage } from "../types/index.js";
import { saveMessage, getGroupFlags } from "../db/messages.repo.js";
import { getCachedGroupMetadata } from "./groupCache.js";
import { extractMessageText } from "./extractText.js";
import { downloadAndStoreMedia } from "./media.js";
import { generateContentLabel } from "../assistant/contentLabel.js";
import { extractMeetingInfo } from "../assistant/meetingInfo.js";
import { sendPushToAllSubscribers } from "../api/pushNotify.js";
import { logger } from "./logger.js";

const GROUP_SUFFIX = "@g.us";

export function registerMessageHandler(
  sock: WASocket,
  categorizer: Categorizer,
  onNewMessage: (message: StoredMessage) => void
): void {
  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const message of messages) {
      const jid = message.key.remoteJid;
      if (!jid || !jid.endsWith(GROUP_SUFFIX)) continue; // only care about community/group chats
      if (!message.message) continue; // e.g. reactions, protocol messages

      const flags = await getGroupFlags(jid);
      if (!flags?.learnEnabled && !flags?.respondEnabled) continue; // not an allowlisted group

      try {
        const { text, messageType } = extractMessageText(message);
        const category = categorizer.categorize({ text, messageType });
        const groupMetadata = getCachedGroupMetadata(jid);
        const mediaUrl = await downloadAndStoreMedia(message, messageType, sock);
        const timestamp = Number(message.messageTimestamp ?? Date.now() / 1000) * 1000;

        let contentLabel: string | null = null;
        let meetingTime: number | null = null;

        if (category === "meeting") {
          const info = await extractMeetingInfo({ text, postedAt: timestamp });
          contentLabel = info?.label ?? null;
          meetingTime = info?.meetingTime ?? null;
        } else if (category === "document") {
          contentLabel = await generateContentLabel({ text, messageType });
        }

        const stored: StoredMessage = {
          id: message.key.id ?? `${jid}-${Date.now()}`,
          groupJid: jid,
          groupName: groupMetadata?.subject ?? jid,
          senderJid: message.key.participant ?? jid,
          senderName: message.pushName ?? "Unknown",
          text,
          messageType,
          category,
          timestamp,
          fromMe: Boolean(message.key.fromMe),
          mediaUrl,
          contentLabel,
          meetingTime,
        };

        await saveMessage(stored);
        onNewMessage(stored);

        if (category === "announcement") {
          void sendPushToAllSubscribers({
            title: `📢 Announcement in ${stored.groupName}`,
            body: text || "New announcement — open the dashboard to see it.",
          });
        }
      } catch (error) {
        logger.error({ err: error }, "failed to process incoming message");
      }
    }
  });
}
