import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import { buildAdminPromptFragment, extractAdminMentions } from "./adminMentions.js";
import type { GroupAdmin, StoredMessage } from "../types/index.js";
import { logger } from "../whatsapp/logger.js";

const SYSTEM_PROMPT = `You're quietly monitoring a WhatsApp group chat. Someone just asked a
question — they did NOT tag you directly, they're just talking in the group. You're given the
group's message history for context.

Decide how to respond:
- If you can confidently answer using facts explicitly stated somewhere in the history (links,
  dates, decisions, instructions, meeting/call details, documents, etc.), answer directly.
- If the question plausibly relates to something the group has shared or discussed (a meeting,
  call, link, document, deadline, announcement, etc.) but it's ambiguous, vague, or could refer
  to more than one thing in the history, ask a short clarifying question instead of guessing —
  e.g. someone asking "any meeting?" when there's exactly one meeting link in the history should
  just get that link, but if it's unclear which thing they mean, or there isn't quite enough
  detail, ask what they need.
- Only stay silent if this is small talk, an opinion question, personal chat, or clearly has
  nothing to do with anything the group has shared — don't jump into unrelated conversation.
When torn between asking a clarifying question and staying silent, prefer asking — it's more
useful than saying nothing, as long as the topic is plausibly something this chat covers.

Respond with ONLY raw JSON, no markdown fences, no extra text, matching exactly this shape:
{"action": "answer" | "clarify" | "silent", "text": string}

If action is "silent", "text" can be an empty string.
When you answer or clarify: write like a real person quickly texting back — plain normal
English, short, no "Based on the chat", "It looks like", or other assistant-speak.`;

export interface AutoAnswerResult {
  text: string;
  mentions: string[];
}

export async function evaluateAutoAnswer(params: {
  groupName: string;
  question: string;
  history: StoredMessage[];
  admins: GroupAdmin[];
}): Promise<AutoAnswerResult | null> {
  if (!gemini) return null;

  const transcript = params.history
    .slice()
    .reverse()
    .map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.senderName}: ${m.text || `<${m.messageType}>`}`)
    .join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Group: ${params.groupName}\n\nRecent messages:\n${transcript || "(no recent messages)"}\n\nSomeone just asked (not tagging you): "${params.question}"`,
      config: {
        systemInstruction: SYSTEM_PROMPT + buildAdminPromptFragment(params.admins),
        maxOutputTokens: 512,
      },
    });

    const raw = response.text?.trim();
    if (!raw) return null;

    const jsonText = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as { action: "answer" | "clarify" | "silent"; text: string };
    if (parsed.action === "silent" || !parsed.text) return null;

    return { text: parsed.text, mentions: extractAdminMentions(parsed.text, params.admins) };
  } catch (error) {
    logger.error({ err: error }, "failed to evaluate auto-answer via Gemini");
    return null;
  }
}
