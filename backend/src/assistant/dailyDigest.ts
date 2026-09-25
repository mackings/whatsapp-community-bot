import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import type { StoredMessage } from "../types/index.js";
import { logger } from "../whatsapp/logger.js";

const SYSTEM_PROMPT = `You write a short daily digest for a WhatsApp group, posted automatically
at a scheduled morning or evening time. You're given the group's messages from the relevant
period (yesterday, for a morning digest; today so far, for an evening one).

Write a friendly, casual recap covering:
- The main things discussed or decided.
- Any links, deadlines, or events mentioned, with their details.

Keep it short and skimmable for a WhatsApp message — a few lines, plain normal English, no
markdown, no "Here's a summary" or other assistant-speak. Just talk like a real person giving a
quick catch-up. Open with a one-line greeting that fits the time of day you're given.`;

export async function generateDailyDigest(params: {
  groupName: string;
  period: "morning" | "evening";
  periodLabel: string;
  history: StoredMessage[];
}): Promise<string | null> {
  if (!gemini) return null;

  const transcript = params.history
    .slice()
    .reverse()
    .map((m) => `[${new Date(m.timestamp).toLocaleString()}] ${m.senderName}: ${m.text || `<${m.messageType}>`}`)
    .join("\n");

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Group: ${params.groupName}\nTime of day: ${params.period}\nCovering: ${params.periodLabel}\n\nMessages:\n${transcript}`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 1024,
      },
    });

    return response.text ?? null;
  } catch (error) {
    logger.error({ err: error }, "failed to generate daily digest via Gemini");
    return null;
  }
}
