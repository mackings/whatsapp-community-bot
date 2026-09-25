import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import { logger } from "../whatsapp/logger.js";

export interface ReminderExtraction {
  remind: boolean;
  event?: string;
  eventTimeISO?: string;
  leadMinutes?: number;
}

const SYSTEM_PROMPT = `You extract event-reminder requests from a WhatsApp message for a bot that
sends reminder DMs. You'll be given the current date/time, a quoted message (what's being
replied to, with when it was posted), and the reply text (what the person just said, tagging
the bot).

Decide if the person is asking to be reminded about an event, link, or meeting mentioned in the
quoted message. If so, figure out when that event happens — resolve relative times ("in 15
minutes", "today at 3pm") using the quoted message's own posted time, not the reply's time.

Respond with ONLY raw JSON, no markdown fences, no extra text, matching exactly this shape:
{"remind": boolean, "event": string, "eventTimeISO": string, "leadMinutes": number}

- "event": a short plain description of what the event is.
- "eventTimeISO": full ISO 8601 datetime (with timezone offset) for when the event happens.
- "leadMinutes": how many minutes before the event to send the reminder — use what the person
  asked for if they gave a number, otherwise default to 15.

If you can't confidently tell this is a reminder request, or can't figure out a specific time,
respond exactly {"remind": false}.`;

export async function extractReminderRequest(params: {
  quotedText: string;
  quotedTimestamp: number;
  replyText: string;
  now: number;
}): Promise<ReminderExtraction | null> {
  if (!gemini) return null;

  const prompt = `Current time: ${new Date(params.now).toISOString()}
Quoted message (posted ${new Date(params.quotedTimestamp).toISOString()}): "${params.quotedText}"
Reply (tagging the bot): "${params.replyText}"`;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 512,
      },
    });

    const raw = response.text?.trim();
    if (!raw) return null;

    const jsonText = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(jsonText) as ReminderExtraction;
  } catch (error) {
    logger.error({ err: error }, "failed to extract reminder request via Gemini");
    return null;
  }
}
