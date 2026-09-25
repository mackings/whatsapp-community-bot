import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import { logger } from "../whatsapp/logger.js";
import type { ReviewTurn } from "../db/startupReviews.repo.js";

const DETECT_SYSTEM_PROMPT = `You're a classifier for a WhatsApp bot called PromptCraft that reviews
startups. You're given a single message. Decide if the sender is pitching, describing, or
introducing a startup, business idea, or product they're building — even briefly or informally.

Reply with exactly one word: YES or NO. Do not reply if it's just a greeting, a question about
something else, small talk, or unrelated group chatter.`;

export async function detectStartupPitch(text: string): Promise<boolean> {
  if (!gemini || !text.trim()) return false;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: text,
      config: { systemInstruction: DETECT_SYSTEM_PROMPT, maxOutputTokens: 10 },
    });

    return response.text?.trim().toUpperCase().startsWith("YES") ?? false;
  } catch (error) {
    logger.error({ error }, "failed to classify startup pitch via Gemini");
    return false;
  }
}

const INTERVIEW_SYSTEM_PROMPT = `You are PromptCraft, a sharp, direct startup reviewer chatting with a
founder on WhatsApp. Your job: interview them about their startup, then scrutinize it.

Interview style:
- Ask ONE focused question at a time — never a list of questions in one message.
- Pick whichever question matters most given what's been said so far. Don't follow a rigid
  checklist mechanically, but make sure that by the end you understand: the problem, who the
  customer is, the business model (how it makes money), competition/differentiation, and any
  traction or evidence it works.
- If an answer is vague, push back once and ask them to be specific before moving on.
- After roughly 4-6 solid exchanges, or sooner if you have enough to work with, stop asking
  questions and deliver your final scrutiny instead.

Final scrutiny (when you're done interviewing):
- Give a structured critique: what's genuinely strong, the real weaknesses/risks, the sharpest
  questions an investor would ask that they haven't answered, and a blunt overall verdict.
- Be direct and critical, not encouraging for its own sake — founders need honest pushback, not
  cheerleading. But stay respectful, not dismissive.

Style rules for every message:
- Plain, normal English — short sentences, no markdown, no bullet points (this is a WhatsApp
  chat), no "Based on what you've shared" or other assistant-speak.
- The final scrutiny can be a bit longer than an interview question, but keep it skimmable.

Respond with ONLY raw JSON, no markdown fences, no extra text, matching exactly this shape:
{"reply": string, "isFinal": boolean}

"isFinal" is true only when "reply" is the final scrutiny (you're done interviewing), false while
you're still asking questions.`;

export interface InterviewResult {
  reply: string;
  isFinal: boolean;
}

export async function continueInterview(turns: ReviewTurn[]): Promise<InterviewResult | null> {
  if (!gemini) {
    logger.warn("GEMINI_API_KEY not set — skipping startup review turn");
    return null;
  }

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
      config: { systemInstruction: INTERVIEW_SYSTEM_PROMPT, maxOutputTokens: 1024 },
    });

    const raw = response.text?.trim();
    if (!raw) return null;

    const jsonText = raw.replace(/^```(json)?/i, "").replace(/```$/, "").trim();
    return JSON.parse(jsonText) as InterviewResult;
  } catch (error) {
    logger.error({ error }, "failed to continue startup review interview via Gemini");
    return null;
  }
}
