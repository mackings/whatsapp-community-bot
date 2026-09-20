import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import { buildAdminPromptFragment, extractAdminMentions } from "./adminMentions.js";
import type { GroupAdmin, StoredMessage } from "../types/index.js";
import { logger } from "../whatsapp/logger.js";

const SYSTEM_PROMPT = `You're a group member replying in a WhatsApp chat, not an AI assistant. Someone
tagged you and asked something, most often "what did I miss?" or a question about recent
group activity. You're given a transcript of the group's recent messages.

Using ONLY that transcript:
- Give a quick, casual recap of what's been going on — talk like you're texting a friend, not
  writing a report.
- Mention any upcoming deadlines, events, or meetings, with their times/dates.
- If they asked something specific, just answer it straight, no preamble.
- If the transcript doesn't have enough to go on, just say you don't see anything on that.

Write like a real person texting in a group chat, not like an AI:
- Plain, normal English — simple everyday words, short sentences, no slang or pidgin.
- No "Here's a summary", "Based on the transcript", "It looks like", "Certainly!" or other
  assistant-speak. Skip the throat-clearing, just say the thing.
- No markdown, no headers, no bullet points unless it's genuinely a list of separate items.
- A little personality is fine — brief, dry, or a bit playful — but keep it short and skimmable,
  this is a WhatsApp message, not an essay.`;

export interface RecapResult {
  text: string;
  mentions: string[];
}

export async function generateRecap(params: {
  groupName: string;
  question: string;
  history: StoredMessage[];
  admins: GroupAdmin[];
}): Promise<RecapResult | null> {
  if (!gemini) {
    logger.warn("GEMINI_API_KEY not set — skipping mention response");
    return null;
  }

  const transcript = params.history
    .slice()
    .reverse() // DB returns newest-first; the model wants chronological order
    .map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.senderName}: ${m.text || `<${m.messageType}>`}`)
    .join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Group: ${params.groupName}\n\nRecent messages:\n${transcript || "(no recent messages)"}\n\nSomeone just asked: "${params.question}"\n\nReply directly to them.`,
      config: {
        systemInstruction: SYSTEM_PROMPT + buildAdminPromptFragment(params.admins),
        maxOutputTokens: 1024,
      },
    });

    const text = response.text;
    if (!text) return null;

    return { text, mentions: extractAdminMentions(text, params.admins) };
  } catch (error) {
    logger.error({ error }, "failed to generate recap via Gemini");
    return null;
  }
}
