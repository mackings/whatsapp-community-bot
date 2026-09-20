import type { Categorizer, Category } from "../types/index.js";

const MEETING_LINK_PATTERN = /zoom\.us|teams\.microsoft\.com|meet\.google\.com|meet\.jit\.si|whereby\.com/i;
const URL_PATTERN = /https?:\/\/\S+/i;

const RULES: Array<{ category: Category; patterns: RegExp[] }> = [
  {
    category: "urgent",
    patterns: [/\burgent\b/i, /\basap\b/i, /emergency/i, /\bhelp+!*\b/i],
  },
  {
    category: "meeting",
    patterns: [MEETING_LINK_PATTERN, /\bmeeting\b.*\blink\b/i, /\bjoin\b.*\bcall\b/i, /\brecording\b/i],
  },
  {
    category: "question",
    patterns: [/\?\s*$/, /^\s*(who|what|when|where|why|how|is|can|does|do)\b/i],
  },
  {
    category: "announcement",
    patterns: [/\bannouncement\b/i, /\breminder\b/i, /\bnotice\b/i, /\bevent\b/i, /\bdeadline\b/i],
  },
  {
    category: "greeting",
    patterns: [/^\s*(hi|hello|hey|good morning|good afternoon|good evening)\b/i],
  },
  {
    category: "spam",
    patterns: [/\bwin\b.*\bprize\b/i, /\bcrypto\b/i, /\bfree money\b/i],
  },
];

const DOCUMENT_TYPES = new Set(["documentMessage"]);
const MEDIA_TYPES = new Set(["imageMessage", "videoMessage", "audioMessage", "stickerMessage"]);

/**
 * Simple, dependency-free keyword/regex classifier. Swap this out for an
 * LLM-backed Categorizer (same interface) once you need real accuracy —
 * see the Categorizer type in src/types/index.ts.
 */
export class KeywordCategorizer implements Categorizer {
  categorize({ text, messageType }: { text: string; messageType: string }): Category {
    if (DOCUMENT_TYPES.has(messageType)) {
      return "document";
    }

    for (const rule of RULES) {
      if (rule.patterns.some((pattern) => pattern.test(text))) {
        return rule.category;
      }
    }

    // A bare link is a shared resource, not spam — spam needs an actual
    // spam signal (see the spam rule above), not just the presence of a URL.
    if (URL_PATTERN.test(text)) {
      return "document";
    }

    if (MEDIA_TYPES.has(messageType) && !text) {
      return "media";
    }

    return "general";
  }
}
