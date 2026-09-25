import { gemini, GEMINI_MODEL } from "./geminiClient.js";
import { logger } from "../whatsapp/logger.js";

const SYSTEM_PROMPT = `You write a very short label (3-6 words) describing what a shared link,
document, or meeting invite in a WhatsApp group is for, based on the message text/caption
around it. Examples: "MIT course info page", "Hackathon submission rules", "Team sync meeting
link", "Bot development guidelines PDF".

Respond with ONLY the label text, nothing else — no quotes, no trailing punctuation, no "Label:"
prefix. If the text genuinely doesn't give enough to guess what it's for, respond with exactly:
Shared link`;

export async function generateContentLabel(params: { text: string; messageType: string }): Promise<string | null> {
  if (!gemini || !params.text.trim()) return null;

  try {
    const response = await gemini.models.generateContent({
      model: GEMINI_MODEL,
      contents: `Message type: ${params.messageType}\nMessage text: "${params.text}"`,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 64,
      },
    });

    return response.text?.trim() || null;
  } catch (error) {
    logger.error({ err: error }, "failed to generate content label via Gemini");
    return null;
  }
}
