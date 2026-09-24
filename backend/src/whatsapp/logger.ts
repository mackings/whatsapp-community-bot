import pino from "pino";

// Silent by default — Baileys and the WhatsApp-side modules are extremely
// chatty (raw crypto buffers, per-message decrypt attempts, connection
// churn). Only API request logs (see api/requestLogger.ts) print by default.
export const logger = pino({ level: process.env.LOG_LEVEL ?? "silent" });
