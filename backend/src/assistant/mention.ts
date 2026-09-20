import { jidNormalizedUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";

/**
 * True when this message @-mentions the bot's own account (WhatsApp's
 * mention feature, not a plain-text "@name" — the actual tag picker).
 */
export function isBotMentioned(message: WAMessage, sock: WASocket): boolean {
  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
  if (mentioned.length === 0) return false;

  // WhatsApp mentions can reference either the bot's phone-number JID or its
  // newer LID (linked identity) — a message may carry either, so check both.
  const botIds = [sock.user?.id, sock.user?.lid].filter((id): id is string => Boolean(id));
  if (botIds.length === 0) return false;

  const normalizedBotIds = new Set(botIds.map(jidNormalizedUser));
  return mentioned.some((jid) => normalizedBotIds.has(jidNormalizedUser(jid)));
}
