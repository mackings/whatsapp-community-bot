import { detectStartupPitch, continueInterview } from "../assistant/startupReview.js";
import { getActiveReview, startReview, appendTurns, type ReviewTurn } from "../db/startupReviews.repo.js";

/**
 * Advances (or starts) a PromptCraft startup-review conversation for one
 * turn. Returns null when this message isn't part of a review and doesn't
 * look like a new pitch — callers should fall back to their normal behavior
 * in that case (e.g. mentionHandler's recap).
 */
export async function handleStartupReviewTurn(params: {
  chatJid: string;
  senderJid: string;
  senderName: string;
  text: string;
}): Promise<{ reply: string } | null> {
  if (!params.text.trim()) return null;

  const active = await getActiveReview(params.chatJid, params.senderJid);
  const userTurn: ReviewTurn = { role: "user", text: params.text };

  if (active) {
    const turns = [...active.turns, userTurn];
    const result = await continueInterview(turns);
    if (!result) return null;

    await appendTurns(active.id, [userTurn, { role: "model", text: result.reply }], result.isFinal);
    return { reply: result.reply };
  }

  const looksLikePitch = await detectStartupPitch(params.text);
  if (!looksLikePitch) return null;

  const result = await continueInterview([userTurn]);
  if (!result) return null;

  await startReview({
    chatJid: params.chatJid,
    senderJid: params.senderJid,
    senderName: params.senderName,
    turns: [userTurn, { role: "model", text: result.reply }],
    completed: result.isFinal,
  });

  return { reply: result.reply };
}
