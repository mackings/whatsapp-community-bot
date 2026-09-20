import "dotenv/config";

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  port: Number(optional("PORT", "4000")),
  pairingNumber: process.env.PAIRING_NUMBER?.trim() || undefined,
  authDir: optional("AUTH_DIR", "./auth_info_baileys"),
  dbPath: optional("DB_PATH", "./data/bot.sqlite"),
  mediaDir: optional("MEDIA_DIR", "./data/media"),
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
  digestTimezone: optional("DIGEST_TIMEZONE", "Africa/Lagos"),
  digestMorningTime: optional("DIGEST_MORNING_TIME", "09:00"),
  digestEveningTime: optional("DIGEST_EVENING_TIME", "18:00"),
  vapidPublicKey: process.env.VAPID_PUBLIC_KEY?.trim() || undefined,
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY?.trim() || undefined,
  vapidSubject: optional("VAPID_SUBJECT", "mailto:admin@example.com"),
};
