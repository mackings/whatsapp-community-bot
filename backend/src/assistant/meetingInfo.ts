import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import { logger } from "../whatsapp/logger.js";

const SYSTEM_PROMPT = `You extract meeting/call info from a WhatsApp message that shares a
meeting link, call invite, or recording. You're given the message text and when it was posted.

Respond with ONLY raw JSON, no markdown fences, no extra text, matching exactly this shape:
{"label": string, "meetingTimeISO": string | null}

- "label": a very short (3-6 word) description of what the meeting is for, e.g. "METI Open Hour
  Q&A", "Team sync call", "Hackathon judging session".
- "meetingTimeISO": the full ISO 8601 datetime (with timezone offset) the meeting happens at,
  resolved from any date/time mentioned in the text relative to when it was posted (e.g. "this
  Friday at 3pm CAT" posted on a given date). Use null if no specific date/time is given, or it's
  just a recording of a past meeting with no future occurrence.`;

export interface MeetingInfo {
  label: string;
  meetingTime: number | null;
}

export async function extractMeetingInfo(params: { text: string; postedAt: number }): Promise<MeetingInfo | null> {
  if (!gemini || !params.text.trim()) return null;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Message posted at: ${new Date(params.postedAt).toISOString()}\nMessage text: "${params.text}"`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 128,
      },
    });

    const raw = response.text?.trim();
    if (!raw) return null;

    const jsonText = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    const parsed = JSON.parse(jsonText) as { label: string; meetingTimeISO: string | null };

    const parsedTime = parsed.meetingTimeISO ? new Date(parsed.meetingTimeISO).getTime() : null;
    return { label: parsed.label, meetingTime: parsedTime && !Number.isNaN(parsedTime) ? parsedTime : null };
  } catch (error) {
    logger.error({ err: error }, "failed to extract meeting info via Gemini");
    return null;
  }
}
