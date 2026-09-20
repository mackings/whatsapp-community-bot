import { GoogleGenAI } from "@google/genai";
import { env } from "../config/env.js";

export const gemini = env.geminiApiKey ? new GoogleGenAI({ apiKey: env.geminiApiKey }) : null;

export const GEMINI_MODEL = "gemini-2.5-flash";
