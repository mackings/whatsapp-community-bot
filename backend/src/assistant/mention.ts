import { jidNormalizedUser, type WAMessage, type WASocket } from "@whiskeysockets/baileys";

function phoneDigits(jid: string | undefined): string | null {
  const match = jid?.match(/^(\d+)/);
  return match ? match[1] : null;
}

/**
 * True when this message @-mentions the bot's own account — either a real
 * WhatsApp mention (picked from the @ autocomplete, populating
 * contextInfo.mentionedJid) or someone just typing the bot's raw number as
 * text (e.g. "@153184387510334") without selecting it from the picker,
 * which looks identical on screen but WhatsApp never treats as an actual
 * mention. Both count here since people reliably do the latter by mistake.
 */
export function isBotMentioned(message: WAMessage, sock: WASocket): boolean {
  // WhatsApp mentions can reference either the bot's phone-number JID or its
  // newer LID (linked identity) — a message may carry either, so check both.
  const botIds = [sock.user?.id, sock.user?.lid].filter((id): id is string => Boolean(id));
  if (botIds.length === 0) return false;

  const mentioned = message.message?.extendedTextMessage?.contextInfo?.mentionedJid ?? [];
  if (mentioned.length > 0) {
    const normalizedBotIds = new Set(botIds.map(jidNormalizedUser));
    if (mentioned.some((jid) => normalizedBotIds.has(jidNormalizedUser(jid)))) return true;
  }

  const text = message.message?.extendedTextMessage?.text ?? message.message?.conversation ?? "";
  const botDigits = botIds.map(phoneDigits).filter((d): d is string => Boolean(d));
  return botDigits.some((digits) => text.includes(`@${digits}`));
}
