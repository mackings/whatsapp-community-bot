import { Type } from "@google/genai";
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
    logger.error({ err: error }, "failed to classify startup pitch via Gemini");
    return false;
  }
}

const NON_PITCH_SYSTEM_PROMPT = `You are PromptCraft, a startup reviewer bot. You're a real presence in a
WhatsApp group or chat, not a generic assistant. Someone just tagged you, but what they said isn't a
startup pitch, it's a question or comment about something else (e.g. asking what the group/program
is about, small talk, a random question).

You're given the group's name and maybe some recent messages for context.
- If you can honestly answer their question from that context, do it briefly and directly.
- If you don't actually know, say so plainly in one short line. Do not guess or make something up.
- Always end with a brief, natural invite to share their startup for a review, since that's what
  you're actually here for. Keep it short, don't force it awkwardly onto small talk.

Style: plain, normal English, short, WhatsApp-message length, no markdown, no em dashes. Never say
"I'm an AI" or "as a bot" or anything like that, just talk like a person would.`;

export async function respondToNonPitch(params: {
  groupName?: string;
  text: string;
  history?: string;
}): Promise<string | null> {
  if (!gemini) return null;

  const context = [
    params.groupName ? `Group name: ${params.groupName}` : null,
    params.history ? `Recent messages:\n${params.history}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `${context ? `${context}\n\n` : ""}They just said: "${params.text}"`,
      config: { systemInstruction: NON_PITCH_SYSTEM_PROMPT, maxOutputTokens: 600 },
    });

    const text = response.text?.trim();
    return text ? text.replace(/—/g, ",") : null;
  } catch (error) {
    logger.error({ err: error }, "failed to generate non-pitch reply via Gemini");
    return null;
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
- No em dashes (—). Use commas or separate sentences instead.
- Never narrate your own process or intent — don't say "I'll take a look at it", "let me review
  this", "hard to roast without more details", or anything describing what you're about to do.
  Just do it: ask the real next question, or give the real critique, directly.
- If you don't have enough to go on yet, don't say so — just ask the specific question that gets
  you what you need (e.g. instead of "hard to roast without more details", ask "what's the actual
  problem this solves?").
- The final scrutiny can be a bit longer than an interview question, but keep it skimmable.

"isFinal" is true only when "reply" is the final scrutiny (you're done interviewing), false while
you're still asking questions.`;

export interface InterviewResult {
  reply: string;
  isFinal: boolean;
}

// Gemini reliably follows "respond with only JSON" most of the time but not
// always — it occasionally answers in plain conversational text instead,
// which broke every turn whose response happened to contain no "{...}" at
// all. responseSchema forces the model's actual decoding to produce valid
// JSON matching this shape, instead of just hoping the prompt is obeyed.
const INTERVIEW_RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    reply: { type: Type.STRING },
    isFinal: { type: Type.BOOLEAN },
  },
  required: ["reply", "isFinal"],
};

async function requestInterviewTurn(turns: ReviewTurn[]): Promise<InterviewResult | null> {
  const response = await gemini!.models.generateContent({
    model: GEMINI_MODEL,
    contents: turns.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
    config: {
      systemInstruction: INTERVIEW_SYSTEM_PROMPT,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
      responseSchema: INTERVIEW_RESPONSE_SCHEMA,
    },
  });

  const raw = response.text?.trim();
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as InterviewResult;
    return { reply: parsed.reply.replace(/—/g, ","), isFinal: parsed.isFinal };
  } catch {
    // Belt and suspenders: if it somehow still isn't valid JSON, use the
    // raw text as the reply directly rather than failing the turn outright.
    return { reply: raw.replace(/—/g, ","), isFinal: false };
  }
}

export async function continueInterview(turns: ReviewTurn[]): Promise<InterviewResult | null> {
  if (!gemini) {
    logger.warn("GEMINI_API_KEY not set — skipping startup review turn");
    return null;
  }

  // One retry with a short delay — an occasional malformed response or a
  // rate-limit blip shouldn't make the bot look like it forgot the whole
  // conversation and drop back to its opening question. An instant retry
  // wouldn't help at all against rate limiting specifically, hence the wait.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1500));
      const result = await requestInterviewTurn(turns);
      if (result) return result;
    } catch (error) {
      // pino only auto-unpacks a plain Error's (non-enumerable) message and
      // stack for a key literally named "err" — anything else serializes to
      // "{}" and the real failure reason is lost.
      logger.error({ err: error, attempt }, "failed to continue startup review interview via Gemini");
    }
  }
  return null;
}
