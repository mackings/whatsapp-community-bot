import { getContentType, type WAMessage } from "@whiskeysockets/baileys";

/**
 * Pulls a plain-text representation out of any message type we care about
 * for categorization (captions count as text for media messages).
 */
export function extractMessageText(message: WAMessage): { text: string; messageType: string } {
  const content = message.message;
  const messageType = content ? getContentType(content) ?? "unknown" : "unknown";

  if (!content) return { text: "", messageType };

  const text =
    content.conversation ??
    content.extendedTextMessage?.text ??
    content.imageMessage?.caption ??
    content.videoMessage?.caption ??
    content.documentMessage?.caption ??
    "";

  return { text: text.trim(), messageType };
}
