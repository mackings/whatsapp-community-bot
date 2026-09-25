import { detectStartupPitch, continueInterview } from "../assistant/startupReview.js";
import { getActiveReview, startReview, appendTurns, type ReviewTurn } from "../db/startupReviews.repo.js";
import { listMessages } from "../db/messages.repo.js";

const OWN_HISTORY_LIMIT = 20;

/**
 * A fresh mention is often fragmented across several of the sender's own
 * messages — the pitch in one, "give me advice on my startup" in a later
 * one with nothing describing it again. Classifying just the single tagged
 * message misses that. Pulls this sender's own recent messages in this
 * chat (never anyone else's — reviews are strictly per-person) so a bare
 * follow-up still reads with its actual context.
 */
async function withOwnHistory(chatJid: string, senderJid: string, text: string): Promise<string> {
  const prior = await listMessages({ groupJid: chatJid, senderJid, limit: OWN_HISTORY_LIMIT });
  const ownHistoryText = prior
    .slice()
    .reverse()
    .map((m) => m.text)
    .filter(Boolean)
    .join("\n");
  return ownHistoryText ? `${ownHistoryText}\n${text}`.trim() : text;
}

export type StartupReviewOutcome =
  | { status: "replied"; reply: string }
  | { status: "no-pitch" }
  | { status: "error"; hasActiveReview: boolean };

/**
 * Advances (or starts) a PromptCraft startup-review conversation for one
 * turn. "no-pitch" means this message isn't part of a review and doesn't
 * look like a new pitch, even with the sender's own recent history factored
 * in — callers should fall back to their normal behavior. "error" means a
 * review exists (or should have started) but Gemini failed — callers should
 * NOT repeat the opening question in that case, since a review is already
 * underway and that reads as the bot forgetting the whole conversation.
 */
export async function handleStartupReviewTurn(params: {
  chatJid: string;
  senderJid: string;
  senderName: string;
  text: string;
}): Promise<StartupReviewOutcome> {
  if (!params.text.trim()) return { status: "no-pitch" };

  const active = await getActiveReview(params.chatJid, params.senderJid);
  const userTurn: ReviewTurn = { role: "user", text: params.text };

  if (active) {
    const turns = [...active.turns, userTurn];
    const result = await continueInterview(turns);
    if (!result) return { status: "error", hasActiveReview: true };

    await appendTurns(active.id, [userTurn, { role: "model", text: result.reply }], result.isFinal);
    return { status: "replied", reply: result.reply };
  }

  const combinedText = await withOwnHistory(params.chatJid, params.senderJid, params.text);
  const looksLikePitch = await detectStartupPitch(combinedText);
  if (!looksLikePitch) return { status: "no-pitch" };

  const openingTurn: ReviewTurn = { role: "user", text: combinedText };
  const result = await continueInterview([openingTurn]);
  if (!result) return { status: "error", hasActiveReview: false };

  await startReview({
    chatJid: params.chatJid,
    senderJid: params.senderJid,
    senderName: params.senderName,
    turns: [openingTurn, { role: "model", text: result.reply }],
    completed: result.isFinal,
  });

  return { status: "replied", reply: result.reply };
}
