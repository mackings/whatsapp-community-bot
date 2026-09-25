import { detectStartupPitch, continueInterview } from "../assistant/startupReview.js";
import {
  getActiveReview,
  startReview,
  appendTurns,
  hasAnyRecord,
  markGreeted,
  type ReviewTurn,
} from "../db/startupReviews.repo.js";
import { listMessages } from "../db/messages.repo.js";

const OWN_HISTORY_LIMIT = 20;

export const PROMPTCRAFT_INTRO =
  "Hey, I'm PromptCraft. Most bots just handle group messages, I do that too, but what I'm really here for is startups. ";

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
  | { status: "no-pitch"; isFirstContact: boolean }
  | { status: "error"; hasActiveReview: boolean };

/**
 * Advances (or starts) a PromptCraft startup-review conversation for one
 * turn. "no-pitch" means this message isn't part of a review and doesn't
 * look like a new pitch, even with the sender's own recent history factored
 * in — callers should fall back to their normal behavior, prepending the
 * intro if isFirstContact. "error" means a review exists (or should have
 * started) but Gemini failed — callers should NOT repeat the opening
 * question in that case, since a review is already underway and that reads
 * as the bot forgetting the whole conversation.
 */
export async function handleStartupReviewTurn(params: {
  chatJid: string;
  senderJid: string;
  senderName: string;
  text: string;
}): Promise<StartupReviewOutcome> {
  if (!params.text.trim()) return { status: "no-pitch", isFirstContact: false };

  const active = await getActiveReview(params.chatJid, params.senderJid);
  const userTurn: ReviewTurn = { role: "user", text: params.text };

  if (active) {
    const turns = [...active.turns, userTurn];
    const result = await continueInterview(turns);
    if (!result) return { status: "error", hasActiveReview: true };

    await appendTurns(active.id, [userTurn, { role: "model", text: result.reply }], result.isFinal);
    return { status: "replied", reply: result.reply };
  }

  // An active review can only exist after first contact, so we only need to
  // check this on the "fresh" path — by definition PromptCraft has already
  // spoken to anyone with an active or completed review.
  const isFirstContact = !(await hasAnyRecord(params.chatJid, params.senderJid));

  const combinedText = await withOwnHistory(params.chatJid, params.senderJid, params.text);
  const looksLikePitch = await detectStartupPitch(combinedText);
  if (!looksLikePitch) {
    if (isFirstContact) await markGreeted(params.chatJid, params.senderJid, params.senderName);
    return { status: "no-pitch", isFirstContact };
  }

  const openingTurn: ReviewTurn = { role: "user", text: combinedText };
  const result = await continueInterview([openingTurn]);
  if (!result) return { status: "error", hasActiveReview: false };

  const reply = isFirstContact ? `${PROMPTCRAFT_INTRO}${result.reply}` : result.reply;

  await startReview({
    chatJid: params.chatJid,
    senderJid: params.senderJid,
    senderName: params.senderName,
    turns: [openingTurn, { role: "model", text: reply }],
    completed: result.isFinal,
  });

  return { status: "replied", reply };
}
